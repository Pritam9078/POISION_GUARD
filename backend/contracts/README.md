# PoisonGuard ProofRegistry v2

An append-only, immutable registry of 32-byte **commitments** (hashes) for PoisonGuard audit checkpoints, methodology releases, evaluation runs, execution evidence and reports. Anyone can verify a record for free; nobody can edit or delete one.

**On chain:** a hash, an opaque scope id, a kind, an ordering link, timestamps.
**Never on chain:** personal data, wallet secrets, report contents, workspace names.

## Who can do what

| Role | Held by (recommended) | Can | Cannot |
|---|---|---|---|
| **Admin** (`DEFAULT_ADMIN_ROLE`) | Platform **multisig** (e.g. Safe 2-of-3) | grant/revoke roles, **unpause**, start/cancel admin transfer | anchor, revoke anchors (unless also granted those roles) |
| **Anchorer** (`ANCHORER_ROLE`) | Backend hot key (`PROOF_ANCHOR_PRIVATE_KEY`), low balance | write anchors, renounce itself | manage roles, unpause, revoke |
| **Pauser** (`PAUSER_ROLE`) | On-call engineer | emergency **pause** of new anchors | unpause (only admin can) |
| **Revoker** (`REVOKER_ROLE`) | Security reviewer | flag an anchor as revoked with a reason hash | edit or delete any anchor |
| **Anyone / users / auditors** | — | `verify`, `getAnchor`, `isAnchored`, `headOf`, `countOf`, `totalAnchors`, `revocationReasonOf` | write anything |

Admin transfer is **two-step with a delay** (OpenZeppelin `AccessControlDefaultAdminRules`): `beginDefaultAdminTransfer` → wait `defaultAdminDelay` → new admin calls `acceptDefaultAdminTransfer`. A stolen admin key cannot take over instantly, and the transfer can be cancelled during the wait.

## Guarantees (each covered by a test)

- Each `batchId` is written once; its commitment can never change. There is no overwrite path.
- **Ordered per scope:** each anchor must name the scope's current head (`expectedPrevBatchId`), so forks and races revert. Every record stores `seq` and `prevBatchId`, and `walkScope()` re-checks the whole chain.
- **Batches are all-or-nothing:** `anchorBatch` takes up to 50 items atomically.
- **Pause** stops new anchors only. Verification and revocation keep working during an incident.
- **Revocation flags, never erases.** The original record stays readable, and `verify()` reports `revoked = true`.
- **Input checks:** zero ids, scopes, commitments and reasons are rejected, and so is an invalid `Kind`.
- **Immutable and closed to ETH:** no proxy, no `selfdestruct`, no payable function, and plain ETH or unknown calls revert.
- **Gas:** under 250k for the first anchor in a scope and under 200k after that (asserted in tests).

`Kind`: 1 AuditCheckpoint · 2 Methodology · 3 Evaluation · 4 Execution · 5 Report.

## Use it

```bash
npm install
npm test                       # 24 tests (use `npm run test:offline` if the solc download is blocked)
npm run abi                    # → abi/ProofRegistry.json
```

### Deploy (testnet first)
```bash
ADMIN_ADDRESS=<multisig> ANCHORER_ADDRESS=<backend key addr> PAUSER_ADDRESS=<on-call> REVOKER_ADDRESS=<security> \
ADMIN_DELAY_SECONDS=172800 SEPOLIA_RPC_URL=… PROOF_ANCHOR_PRIVATE_KEY=<deployer key> npm run deploy:sepolia
```
The deploy script refuses to run on public networks if any role address is missing, if the admin delay is under 24 hours, or if the admin and anchorer are the same key. It writes `deployments/<network>.json` and prints the `hardhat verify` command.

Backend `.env`: `PROOF_REGISTRY_CHAIN_ID`, `PROOF_REGISTRY_ADDRESS`, `PROOF_ANCHOR_PRIVATE_KEY` (the **anchorer** key, never the admin's).

### Admin operations
```bash
CMD=status                                   REGISTRY=0x… npm run admin -- --network sepolia
CMD="grant-anchorer 0xNEW"                   REGISTRY=0x… npm run admin -- --network sepolia
CMD="revoke-anchorer 0xOLD"                  …   # key rotation: grant new, switch backend, revoke old
CMD=pause                                    …   # pauser
CMD=unpause                                  …   # admin (multisig)
CMD="revoke-anchor 0xBATCH reason text"      …   # revoker; only the hash of the reason goes on chain
CMD="begin-admin-transfer 0xNEWADMIN" | accept-admin-transfer | cancel-admin-transfer
```
When the admin is a Safe, submit these calls through the Safe UI using `abi/ProofRegistry.json`.

### Verify (anyone, no account needed)
```bash
REGISTRY=0x… BATCH_ID=0x… COMMITMENT=0x… npm run verify-anchor -- --network sepolia   # → VALID / REVOKED / COMMITMENT MISMATCH / NOT ANCHORED
REGISTRY=0x… SCOPE=0x… npm run verify-anchor -- --network sepolia                     # walks and checks the scope's whole chain
```
In code, `client/proof-registry.js` provides `verify`, `getAnchor`, `walkScope`, `anchor` and `confirmFromReceipt`. Scope ids are `keccak256("poisonguard:scope:" + workspaceId)`, or `"platform"` for the platform scope.

## Incident runbook
1. **Anchorer key leaked:** pause → grant a new anchorer → update the backend env → revoke the old key (or let it renounce) → revoke any bogus anchors → unpause (admin).
2. **Wrong data anchored:** revoke that batch with a reason hash, then anchor a corrected checkpoint (a new batch id that chains on the current head).
3. **Admin key at risk:** begin an admin transfer to a fresh multisig. The delay gives time to cancel if the transfer itself was malicious.

## Not done (be explicit before mainnet)
- No **third-party audit** yet, and no Slither/Mythril run: their compiler downloads were blocked in the build environment. Run `slither .` before mainnet.
- Hardhat's compiler download was also blocked, so tests here ran on the npm `solcjs` build of 0.8.24. Run `npm test` once on a networked machine with the native compiler.
- No contract source verification on an explorer yet (do it after deploy).
- Cost: anchoring is paid by the anchorer key, so fund it modestly and monitor its balance.
