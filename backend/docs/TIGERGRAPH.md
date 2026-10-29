# TigerGraph (optional graph mirror)

Status: **adapter implemented, not tested against a live cluster.** Enable with `TIGERGRAPH_HOST`, `TIGERGRAPH_TOKEN`, `TIGERGRAPH_GRAPH_NAME` and the `tigergraph_sync` feature flag. Without them, sync jobs record `skipped` and graph views fall back to PostgreSQL.

PostgreSQL remains the system of record. Sync is post-scan, best-effort, idempotent (vertices keyed by id; upsert), tracked in `graph_sync_jobs` (`pending|synced|failed|skipped`, attempts, error).

## Schema (GSQL)

```gsql
CREATE VERTEX Wallet  (PRIMARY_ID id STRING, chain_id INT, address STRING) WITH primary_id_as_attribute="true"
CREATE VERTEX Token   (PRIMARY_ID id STRING, chain_id INT, address STRING)
CREATE VERTEX Finding (PRIMARY_ID id STRING, rule_id STRING, severity STRING)
CREATE DIRECTED EDGE TRANSFERRED (FROM Wallet, TO Wallet, DISCRIMINATOR(tx_hash STRING), token STRING, value STRING, block INT)
CREATE DIRECTED EDGE HAS_FINDING (FROM Wallet, TO Finding)
CREATE DIRECTED EDGE FLAGGED_IN  (FROM Wallet, TO Finding)
CREATE GRAPH PoisonGuard (Wallet, Token, Finding, TRANSFERRED, HAS_FINDING, FLAGGED_IN)
```
Vertex id = `<chainId>:<address>`.

## Query used by the API

`pg_neighbors(VERTEX<Wallet> wallet, INT max_results)` — 1-hop counterparties with transfer counts and attached findings. Called with a 15 s timeout; on error the API falls back to PostgreSQL.

## Boundaries

Graph traversal is only offered for addresses the workspace watches (`GET W/graph/neighbors?walletId=`), depth 1, result-limited. Proximity is context, never proof.

## Verification checklist before enabling

1. Create schema + install `pg_neighbors`. 2. Point a staging API at it, run a workspace scan, confirm `graph_sync_jobs.status = synced` and vertex counts. 3. Compare `neighbors()` output with the PostgreSQL fallback for the same wallet. 4. Kill the cluster and confirm scans still complete (sync `failed`, scan unaffected).
