// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title  PoisonGuard ProofRegistry
 * @notice Public, append-only registry of 32-byte commitments (hashes) of PoisonGuard audit checkpoints,
 *         methodology releases, evaluation reports and execution evidence.
 *
 *         What it stores:  a hash, an opaque scope id, a kind, an ordering link, timestamps.
 *         What it NEVER stores: personal data, wallet secrets, report contents, workspace names.
 *
 * Roles
 *  - DEFAULT_ADMIN  (platform multisig) grants/revokes roles, unpauses. Transfer is two-step with a delay
 *                   (OpenZeppelin AccessControlDefaultAdminRules), so a stolen key cannot instantly take over.
 *  - ANCHORER_ROLE  (backend hot key)  writes anchors. Cannot change roles, cannot unpause, cannot revoke.
 *  - PAUSER_ROLE    (on-call)           emergency stop for new anchors. Cannot unpause (only admin can).
 *  - REVOKER_ROLE   (security review)   flags an anchor as revoked with a reason hash. Never deletes or edits it.
 *
 * Guarantees
 *  - A batch id can be written exactly once; a commitment can never be changed (no overwrite path exists).
 *  - Per scope, anchors form an ordered chain: each new anchor must name the scope's current head
 *    (`expectedPrevBatchId`). Concurrent or forked submissions revert instead of silently branching.
 *  - Immutable deployment: no proxy, no selfdestruct, no upgrade path, no payable functions (ETH is rejected).
 *  - Anyone can verify: `verify(batchId, commitment)` / `getAnchor(batchId)` are free view calls.
 */
contract ProofRegistry is AccessControlDefaultAdminRules, Pausable {
    // ───────────────────────────── roles & limits ─────────────────────────────
    bytes32 public constant ANCHORER_ROLE = keccak256("ANCHORER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");
    uint256 public constant MAX_BATCH_SIZE = 50;
    /// @notice Semantic version of the on-chain record format. Off-chain verifiers should check it.
    string public constant VERSION = "2.0.0";

    // ───────────────────────────── types ─────────────────────────────
    enum Kind {
        None, // 0 — invalid, never stored
        AuditCheckpoint, // 1 — head hash of a workspace/platform audit hash-chain range
        Methodology, // 2 — hash of a published detection-methodology version
        Evaluation, // 3 — hash of a recorded accuracy evaluation run
        Execution, // 4 — hash of spend-intent execution / reconciliation evidence
        Report // 5 — hash of a security report or scan export
    }

    struct Anchor {
        bytes32 scope; // opaque id, e.g. keccak256(workspaceId) or keccak256("platform")
        bytes32 commitment; // the hash being anchored (never zero)
        bytes32 prevBatchId; // previous head of this scope (zero for the first)
        uint64 seq; // 1-based position within the scope
        uint64 timestamp; // block.timestamp at anchoring
        uint64 blockNumber; // block.number at anchoring
        Kind kind;
        address submitter; // anchorer that wrote it
        bool revoked;
    }

    struct AnchorInput {
        bytes32 batchId;
        bytes32 scope;
        bytes32 commitment;
        Kind kind;
        bytes32 expectedPrevBatchId;
    }

    // ───────────────────────────── storage ─────────────────────────────
    mapping(bytes32 batchId => Anchor) private _anchors;
    /// @notice Current head (latest batch id) of each scope.
    mapping(bytes32 scope => bytes32 batchId) public headOf;
    /// @notice Number of anchors in each scope.
    mapping(bytes32 scope => uint64 count) public countOf;
    /// @notice Reason hash recorded when an anchor was revoked (zero if not revoked).
    mapping(bytes32 batchId => bytes32 reasonHash) public revocationReasonOf;
    /// @notice Total anchors ever written.
    uint256 public totalAnchors;

    // ───────────────────────────── events ─────────────────────────────
    event Anchored(
        bytes32 indexed batchId,
        bytes32 indexed scope,
        bytes32 commitment,
        Kind kind,
        uint64 seq,
        bytes32 prevBatchId,
        address indexed submitter,
        uint64 timestamp
    );
    event AnchorRevoked(bytes32 indexed batchId, bytes32 indexed scope, bytes32 reasonHash, address indexed revoker);

    // ───────────────────────────── errors ─────────────────────────────
    error ZeroBatchId();
    error ZeroScope();
    error ZeroCommitment();
    error InvalidKind();
    error AlreadyAnchored(bytes32 batchId);
    error StaleHead(bytes32 scope, bytes32 expected, bytes32 actual);
    error NotAnchored(bytes32 batchId);
    error AlreadyRevoked(bytes32 batchId);
    error ZeroReason();
    error EmptyBatch();
    error BatchTooLarge(uint256 size, uint256 max);
    error ZeroAddress();

    /**
     * @param initialAdminDelay seconds a pending admin transfer must wait (recommend ≥ 2 days on mainnet)
     * @param admin             platform multisig (DEFAULT_ADMIN)
     * @param anchorer          backend anchoring key
     * @param pauser            on-call emergency key
     * @param revoker           security-review key (may equal admin)
     */
    constructor(uint48 initialAdminDelay, address admin, address anchorer, address pauser, address revoker)
        AccessControlDefaultAdminRules(initialAdminDelay, admin)
    {
        if (anchorer == address(0) || pauser == address(0) || revoker == address(0)) revert ZeroAddress();
        _grantRole(ANCHORER_ROLE, anchorer);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(REVOKER_ROLE, revoker);
    }

    // ───────────────────────────── writes ─────────────────────────────

    /// @notice Anchor one commitment. Reverts unless `expectedPrevBatchId` equals the scope's current head.
    function anchor(bytes32 batchId, bytes32 scope, bytes32 commitment, Kind kind, bytes32 expectedPrevBatchId)
        external
        onlyRole(ANCHORER_ROLE)
        whenNotPaused
        returns (uint64 seq)
    {
        return _anchor(batchId, scope, commitment, kind, expectedPrevBatchId);
    }

    /// @notice Anchor up to MAX_BATCH_SIZE commitments atomically (all or nothing). Items for the same scope must be chained in order.
    function anchorBatch(AnchorInput[] calldata items)
        external
        onlyRole(ANCHORER_ROLE)
        whenNotPaused
        returns (uint64[] memory seqs)
    {
        uint256 n = items.length;
        if (n == 0) revert EmptyBatch();
        if (n > MAX_BATCH_SIZE) revert BatchTooLarge(n, MAX_BATCH_SIZE);
        seqs = new uint64[](n);
        for (uint256 i; i < n; ++i) {
            AnchorInput calldata it = items[i];
            seqs[i] = _anchor(it.batchId, it.scope, it.commitment, it.kind, it.expectedPrevBatchId);
        }
    }

    /**
     * @notice Flag an anchor as revoked (e.g. the off-chain data it commits to was found to be wrong).
     *         The original record is kept and still readable; only the `revoked` flag and a reason hash are added.
     *         Allowed while paused so incidents can be handled during an emergency stop.
     */
    function revoke(bytes32 batchId, bytes32 reasonHash) external onlyRole(REVOKER_ROLE) {
        Anchor storage a = _anchors[batchId];
        if (a.kind == Kind.None) revert NotAnchored(batchId);
        if (a.revoked) revert AlreadyRevoked(batchId);
        if (reasonHash == bytes32(0)) revert ZeroReason();
        a.revoked = true;
        revocationReasonOf[batchId] = reasonHash;
        emit AnchorRevoked(batchId, a.scope, reasonHash, msg.sender);
    }

    /// @notice Emergency stop for new anchors (verification keeps working).
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Only the admin (multisig) can resume — a compromised pauser key cannot toggle the registry.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ───────────────────────────── reads (for users & auditors) ─────────────────────────────

    function getAnchor(bytes32 batchId) external view returns (Anchor memory) {
        Anchor memory a = _anchors[batchId];
        if (a.kind == Kind.None) revert NotAnchored(batchId);
        return a;
    }

    function isAnchored(bytes32 batchId) external view returns (bool) {
        return _anchors[batchId].kind != Kind.None;
    }

    /**
     * @notice One-call verification for anyone holding an off-chain record.
     * @return exists    batch id is anchored
     * @return matches   stored commitment equals `commitment`
     * @return revoked   anchor was later revoked (treat as not trustworthy)
     * @return timestamp when it was anchored
     */
    function verify(bytes32 batchId, bytes32 commitment)
        external
        view
        returns (bool exists, bool matches, bool revoked, uint64 timestamp)
    {
        Anchor storage a = _anchors[batchId];
        exists = a.kind != Kind.None;
        matches = exists && a.commitment == commitment;
        revoked = a.revoked;
        timestamp = a.timestamp;
    }

    // ───────────────────────────── internals ─────────────────────────────

    function _anchor(bytes32 batchId, bytes32 scope, bytes32 commitment, Kind kind, bytes32 expectedPrevBatchId)
        private
        returns (uint64 seq)
    {
        if (batchId == bytes32(0)) revert ZeroBatchId();
        if (scope == bytes32(0)) revert ZeroScope();
        if (commitment == bytes32(0)) revert ZeroCommitment();
        if (kind == Kind.None || uint8(kind) > uint8(Kind.Report)) revert InvalidKind();
        if (_anchors[batchId].kind != Kind.None) revert AlreadyAnchored(batchId);
        bytes32 head = headOf[scope];
        if (head != expectedPrevBatchId) revert StaleHead(scope, expectedPrevBatchId, head);

        seq = countOf[scope] + 1;
        _anchors[batchId] = Anchor({
            scope: scope,
            commitment: commitment,
            prevBatchId: head,
            seq: seq,
            timestamp: uint64(block.timestamp),
            blockNumber: uint64(block.number),
            kind: kind,
            submitter: msg.sender,
            revoked: false
        });
        headOf[scope] = batchId;
        countOf[scope] = seq;
        unchecked {
            ++totalAnchors;
        }
        emit Anchored(batchId, scope, commitment, kind, seq, head, msg.sender, uint64(block.timestamp));
    }
}
