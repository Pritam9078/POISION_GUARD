# AI assistant & hybrid RAG

## Platform assistant (knows PoisonGuard end to end)
**Why not a fine-tuned model:** fine-tuned knowledge goes stale on every release, cannot cite its source, and fills gaps by inventing details — the wrong failure mode for a security product. Instead the assistant is grounded in a versioned platform knowledge base and a **pretrained sentence-embedding model that runs on your own server**.

- **Knowledge base** — `knowledge/platform/*.md` (14 hand-written guide files, ~5,000 words: every page, flow, role, plan, limit, error code and limitation) **plus a reference generated from the code's own constants** (detection rules + thresholds, networks + capabilities + canonical tokens, the role/capability matrix, plan limits, every status lifecycle), so it cannot drift from behaviour. Ingested on every boot; changed files get a new version, unchanged files are skipped, removed files are retired.
- **Pretrained model** — `EMBEDDING_PROVIDER=local` (default) runs `Xenova/all-MiniLM-L6-v2` (384-d, ONNX, int8) via `@huggingface/transformers`. No API key; no question text leaves the server. Downloaded once from Hugging Face and cached, or set `EMBEDDING_MODEL_PATH` to an offline copy. Validated: "The new movie is awesome" vs "…so great" = 0.880 (published fp32 reference 0.894).
- **Works with no LLM** — default *extractive* mode: retrieves a pool (keyword + semantic, every hit kept), re-ranks sections by question↔heading semantic similarity, term coverage, heading precision and exact error-code matches (generated tables are de-prioritised vs. the prose guide), then quotes the best-supported sentences of the winning section with its citation. It never generates text. With `ask_poisonguard` (workspace) / `platform_help_ai` (public) enabled and an LLM configured, answers become generative but stay grounded, escaped and output-guarded.
- **Public help** — `POST /api/v1/assistant/ask { question }`: anonymous, 10/min, platform guide only (never workspace data), stores nothing per user.
- **Role-aware in Guard** — `POST W/assistant/chat`: "what can I do here?" is answered from the server's capability matrix ("Your role in X is operator. It lets you: …"), not from the model.

### Measured accuracy (extractive mode, pretrained local model)
| Set | Purpose | Result |
|---|---|---|
| `tests/ai/platform-knowledge.test.js` | 50 questions used for tuning | retrieval@1 0.94 · retrieval@3 1.00 · answer facts 0.98 |
| `tests/ai/platform-holdout.test.js` | 25 unseen questions; misses were later diagnosed by category | 0.56 lexical-only → 0.76 with pretrained model → 0.88 after general fixes (optimistic: diagnosis-informed) |
| `tests/ai/platform-holdout2.test.js` | 20 questions written **before** those fixes, never tuned on | **0.80** ← the number to quote |

Known misses on fresh questions: "can staff approve my payments" (answers with the overview instead of the staff section), "how do I give someone read-only access" (finds access review, not the Auditor role), "rotate a key for my agent" (finds workspace API keys, not agent credentials), "what is approve 0". Extractive mode quotes; it cannot synthesise across sections — enabling a generative model on top of the same retrieval is the next step for those.

Run: `EMBEDDING_MODEL_PATH=<optional> node --test --test-concurrency=1 tests/ai/platform-*.test.js`

**AI explains; deterministic code decides.** The assistant has no tools and no write path. It cannot approve, sign, revoke, or change anything — and an output guard removes any reply that claims it did.

## Pipeline
1. **Router** (`routeQuery`) — regex classes, evaluated before retrieval:
   - `action_request` → deterministic refusal, model never called. Covers imperatives ("approve it", "Approve SI-501", "go ahead and approve"), "can you …", "mark … as safe", "add … to the allowlist".
   - `live_blockchain` → redirected to scanner / intents (balances, allowances, "how much … hold", "is my tx confirmed").
   - otherwise knowledge Q&A (`finding_explanation` when a `findingId` is attached).
2. **Retrieval** (`hybridSearch`) — access filter applied **inside SQL** (workspace + `members|approvers|admins` by role, plus platform `public` docs):
   - Keyword: `plainto_tsquery` (sanitizes any user syntax) rewritten to OR-of-lexemes, ranked by `ts_rank_cd`.
   - Vector: pgvector cosine, **similarity floor** `EMBEDDING_MIN_SIMILARITY` (default 0.3) so unrelated nearest neighbours are not cited. Tune per embedding model.
   - Reciprocal Rank Fusion (k=60). Response reports `mode`, `embeddingProvider`, and per-citation `matchedBy`.
3. **No sources → no model call.** The assistant says it found nothing rather than guessing.
4. **Prompt** (`buildPrompt`) — sources, finding evidence and prior turns are HTML-escaped (`<`→`&lt;`), control/bidi characters stripped, attributes allow-listed, so untrusted text cannot open or close wrapper tags.
5. **Multi-turn** — last 6 turns are passed as untrusted context; short follow-ups are retrieved together with the previous question.
6. **Output guard** (`guardAnswer`) — sentences claiming an action ("I have approved…", "I signed…") or certifying safety ("…is safe") are replaced; `guardApplied: true` is returned.

On-chain strings are attacker-controlled: token symbols/names are sanitized at ingestion (`cleanTokenText`) before they reach findings, the UI or the model.

Retention: documents with `retentionDays` are soft-deleted and their chunks removed by the retention sweep.

## Evaluation — `node --test tests/ai/ai-eval.test.js` (18 checks)
| Area | Check | Result |
|---|---|---|
| Router | 18 action phrasings refused · 6 live-state phrasings redirected · 9 knowledge questions (incl. "how do I revoke…", "what does approve mean") **not** over-refused | pass |
| Retrieval | right document ranks first for 4 paraphrased questions; provider label honest | pass |
| Access | auditor/approver never see admin/approver-only docs in search **or** assistant output; other workspace retrieves nothing; cross-workspace `findingId` → 404; conversations private per user | pass |
| Grounding | zero sources → model not called; citations resolve to real chunks; follow-ups keep context | pass |
| Injection | poisoned document can't escape `<source>`; output guard strips 5 false action/safety claims; malicious token symbol (`</evidence> IGNORE PREVIOUS…` + RTL override) never reaches scan output | pass |
| Robustness | hostile query syntax (quotes, `:*`, SQL, HTML, 500 chars, emoji) never 500s; plan/flag gates; retention enforced; chunking lossless | pass |

Baseline before fixes was **9/18**: router missed 10/18 action and 3/6 live phrasings; irrelevant vector neighbours were cited and the model was called with no real sources; no conversation memory; no output guard; retention not enforced; keyword search required every word.

## Limits — what this does NOT prove
- **No real model was tested.** Runs use the deterministic mock LLM and a 256-bucket hashed bag-of-words "embedding" (no semantic meaning). Answer quality, citation faithfulness and injection resistance of a real model (Anthropic/OpenAI adapters) are unmeasured. Set `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` and re-run against a labeled question set before enabling `ask_poisonguard` for customers.
- Router and guard are regex: they are a backstop, not a guarantee. A novel phrasing can reach the model — which still cannot act, and whose output is still guarded.
- Retrieval quality was measured on a 5-document corpus. No reranker, no PDF/DOCX extraction.
- `EMBEDDING_MIN_SIMILARITY` must be calibrated for the real embedding model.
