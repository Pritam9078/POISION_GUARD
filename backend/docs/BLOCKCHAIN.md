# Blockchain integration

- **Library**: ethers v6, read-only `JsonRpcProvider` per chain (`adapters/chains/evm.js`), `cacheTimeout: -1` so confirmation counts never use a cached head.
- **Interface**: `getChainInfo, getBlockNumber, getBlock, getTransaction, getTransactionReceipt, getLogs, getCode, estimateGas, getTokenMetadata, getAllowance, scanLogs, getTransferHistory, getApprovalHistory`. A deterministic in-memory implementation (`tests/helpers/fake-chain.js`) is used by tests only.
- **Chains** (`shared/chains.js`): Ethereum 1, Base 8453, Arbitrum 42161, OP 10, Polygon 137, BSC 56, Sepolia 11155111. A chain is reported `offline` with no capabilities until its `*_RPC_URL` is set. Admin can disable or **narrow** capabilities; adding capabilities requires a code release.
- **History coverage**: without an indexer, ERC-20 Transfer/Approval logs are scanned for the last `SCAN_LOG_BLOCK_RANGE` blocks with adaptive chunking (range is halved when providers reject wide ranges). Native-tx history needs an indexer → reported `unavailable`. With `ETHERSCAN_API_KEY`, Etherscan V2 provides full token + native history (capped at 10 000 rows → `partial`). Every scan stores its coverage per source.
- **Pinned reads**: allowances are read at the scan's pinned block; scans record `pinned_block`.
- **Confirmations** per chain (`confirmations`), used by revoke verification and intent reconciliation.
- **Reorgs**: verifications re-read state after N confirmations; a reorg before finality leaves the item `submitted`/`confirmed_pending_finality` and it is re-checked. Deep reorg handling for stored transfers is **not** implemented (they are evidence snapshots tied to a pinned block).

## Detection rules v1.0 (`modules/scanner/rules.js`)

| Rule | What | Severity |
|---|---|---|
| PG-POISON-001 | Address sharing ≥4 leading + ≥4 trailing hex chars (strong) or ≥3/≥3, total ≥7 (weak) with an *established* counterparty (one the wallet actually paid, or an active trusted recipient) that the wallet never paid | high (strong + zero/dust), medium (strong), low (weak) |
| PG-POISON-002 | Zero-value Transfer log naming the wallet as sender, sent by a different tx sender | medium (85 % conf when tx sender verified) |
| PG-POISON-003 | ≥3 distinct senders of zero/dust (<0.01 token) transfers | medium |
| PG-POISON-004 | Token with a canonical symbol (USDC/USDT/DAI/WETH) at a non-canonical address | medium |
| PG-APPROVAL-001 | Allowance ≥ 2^128 | high (unrecognized spender) / low (recognized label) |
| PG-APPROVAL-002 | Non-zero allowance to an address with no code | critical (unlimited) / high |

`riskScore` = max severity weight + 5 per extra finding (ordering heuristic, **not calibrated**). No findings + missing transfer history ⇒ `inconclusive`, never "low".

## Transactions the platform prepares (never signs)

- Revoke: `approve(spender, 0)` to the token contract; verified by receipt → finality → `allowance()` re-read == 0.
- Spend intent: native `{to, value}` or ERC-20 `transfer(to, amount)`; reconciled against sender, target, calldata **and** the recipient's Transfer-log total (catches fee-on-transfer/partial).

## Smart contract

`contracts/src/ProofRegistry.sol` — stores one bytes32 commitment per batch id, allow-listed anchorers, replay-protected, immutable (no proxy). Tests: `cd contracts && npx hardhat test` (set `HARDHAT_LOCAL_SOLC=1` offline). Deploy to a testnet first: `npm run deploy:sepolia`. A proof is `anchored` only after the receipt succeeds **and** the `Anchored(batchId, commitment)` event matches. Verified end-to-end in `tests/e2e/evm.e2e.test.js`.
