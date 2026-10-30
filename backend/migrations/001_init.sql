-- PoisonGuard initial schema (system of record).
-- Status columns are text validated by src/shared/states.js; workspace-owned
-- tables carry workspace_id with FK + index for tenant scoping.

CREATE EXTENSION IF NOT EXISTS vector;

-- ───────────── identity ─────────────
CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text,
  email_verified_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  failed_logins int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip text, user_agent text,
  method text NOT NULL DEFAULT 'password',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE auth_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallet_identities (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address text NOT NULL,
  chain_id int NOT NULL,
  wallet_type text NOT NULL DEFAULT 'unknown',
  verified_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, address)
);
CREATE INDEX wallet_identities_addr_idx ON wallet_identities(address);

CREATE TABLE wallet_challenges (
  id text PRIMARY KEY,
  address text NOT NULL,
  chain_id int NOT NULL,
  nonce text NOT NULL UNIQUE,
  message text NOT NULL,
  purpose text NOT NULL,
  user_id text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ───────────── tenancy ─────────────
CREATE TABLE workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  scope jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE invitations (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  message text,
  invited_by_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitations_ws_idx ON invitations(workspace_id, status);

-- ───────────── chains & chain data ─────────────
CREATE TABLE chains (
  id int PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  symbol text NOT NULL,
  explorer_url text NOT NULL,
  environment text NOT NULL DEFAULT 'mainnet',
  rpc_env_var text NOT NULL,
  capabilities text[] NOT NULL DEFAULT '{}',
  confirmations int NOT NULL DEFAULT 2,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tokens (
  id text PRIMARY KEY,
  chain_id int NOT NULL,
  address text NOT NULL,
  symbol text NOT NULL,
  name text NOT NULL,
  decimals int NOT NULL,
  is_canonical boolean NOT NULL DEFAULT false,
  UNIQUE (chain_id, address)
);
CREATE INDEX tokens_symbol_idx ON tokens(chain_id, symbol);

CREATE TABLE transfers (
  id text PRIMARY KEY,
  chain_id int NOT NULL,
  tx_hash text NOT NULL,
  log_index int NOT NULL,
  block_number bigint NOT NULL,
  ts timestamptz,
  kind text NOT NULL,
  token text,
  from_address text NOT NULL,
  to_address text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, tx_hash, log_index)
);
CREATE INDEX transfers_from_idx ON transfers(chain_id, from_address);
CREATE INDEX transfers_to_idx ON transfers(chain_id, to_address);

CREATE TABLE blockchain_transactions (
  id text PRIMARY KEY,
  chain_id int NOT NULL,
  hash text NOT NULL,
  from_address text NOT NULL,
  to_address text,
  value text NOT NULL,
  input text,
  block_number bigint,
  status int,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, hash)
);

CREATE TABLE approval_records (
  id text PRIMARY KEY,
  chain_id int NOT NULL,
  owner text NOT NULL,
  token text NOT NULL,
  spender text NOT NULL,
  allowance text NOT NULL,
  is_unlimited boolean NOT NULL,
  spender_is_contract boolean,
  last_verified_block bigint,
  status text NOT NULL DEFAULT 'detected',
  revoke_tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, owner, token, spender)
);

-- ───────────── scanning ─────────────
CREATE TABLE scans (
  id text PRIMARY KEY,
  workspace_id text REFERENCES workspaces(id) ON DELETE CASCADE,
  requested_by text,
  agent_id text,
  subject text NOT NULL,
  subject_type text NOT NULL,
  chain_id int NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  risk_score int,
  risk_label text,
  summary text,
  pinned_block bigint,
  rule_version text NOT NULL,
  error text,
  parent_scan_id text,
  ip_hash text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX scans_ws_idx ON scans(workspace_id, requested_at DESC);
CREATE INDEX scans_subject_idx ON scans(subject);
CREATE INDEX scans_status_idx ON scans(status);

CREATE TABLE scan_sources (
  id text PRIMARY KEY,
  scan_id text NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  source text NOT NULL,
  status text NOT NULL,
  note text NOT NULL,
  from_block bigint,
  to_block bigint
);
CREATE INDEX scan_sources_scan_idx ON scan_sources(scan_id);

CREATE TABLE detection_rules (
  id text PRIMARY KEY,
  rule_id text NOT NULL,
  version text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  default_severity text NOT NULL,
  thresholds jsonb NOT NULL,
  known_false_positives text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, version)
);

CREATE TABLE findings (
  id text PRIMARY KEY,
  scan_id text NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  rule_id text NOT NULL,
  rule_version text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL,
  risk_score int NOT NULL,
  confidence int NOT NULL,
  summary text NOT NULL,
  limitations text NOT NULL,
  recommendation text NOT NULL,
  subject_address text,
  related_address text,
  review_status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX findings_scan_idx ON findings(scan_id);
CREATE INDEX findings_related_idx ON findings(related_address);

CREATE TABLE evidence (
  id text PRIMARY KEY,
  finding_id text NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NOT NULL,
  source text NOT NULL,
  value text NOT NULL,
  tx_hash text,
  block_number bigint,
  log_index int,
  observed_at timestamptz
);
CREATE INDEX evidence_finding_idx ON evidence(finding_id);

CREATE TABLE share_links (
  id text PRIMARY KEY,
  scan_id text NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE false_positive_reports (
  id text PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  scan_id text,
  finding_id text,
  chain_id int NOT NULL,
  subject text NOT NULL,
  category text NOT NULL,
  explanation text NOT NULL,
  tx_link text,
  contact_email text,
  consent boolean NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  assigned_to text,
  dedupe_hash text NOT NULL UNIQUE,
  ip_hash text,
  contact_purge_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fpr_status_idx ON false_positive_reports(status);

CREATE TABLE review_decisions (
  id text PRIMARY KEY,
  report_id text REFERENCES false_positive_reports(id),
  finding_id text,
  staff_id text NOT NULL,
  decision text NOT NULL,
  notes text NOT NULL,
  supporting_tx text,
  escalation text,
  regression_candidate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE phishing_reports (
  id text PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  url text NOT NULL,
  evidence text NOT NULL,
  contact_email text,
  consent boolean NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ───────────── guard: wallets & recipients ─────────────
CREATE TABLE watched_wallets (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label text NOT NULL,
  address text NOT NULL,
  chain_id int NOT NULL,
  wallet_type text NOT NULL,
  owner_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  alert_prefs text[] NOT NULL DEFAULT '{}',
  frequency_minutes int NOT NULL DEFAULT 15,
  tags text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  last_checked_at timestamptz,
  last_scan_id text,
  created_by_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  UNIQUE (workspace_id, chain_id, address)
);

CREATE TABLE trusted_recipients (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label text NOT NULL,
  address text NOT NULL,
  chain_id int NOT NULL,
  token_restrictions text[] NOT NULL DEFAULT '{}',
  allowed_use text NOT NULL,
  verification_method text NOT NULL,
  verification_evidence text NOT NULL,
  reviewer_user_id text,
  status text NOT NULL DEFAULT 'pending_verification',
  effective_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  notes text NOT NULL DEFAULT '',
  version int NOT NULL DEFAULT 1,
  created_by_id text NOT NULL,
  updated_by_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, chain_id, address)
);

CREATE TABLE trusted_recipient_versions (
  id text PRIMARY KEY,
  recipient_id text NOT NULL REFERENCES trusted_recipients(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  change text NOT NULL,
  changed_by_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_id, version)
);

-- ───────────── agents ─────────────
CREATE TABLE agents (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  owner_user_id text NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  allowed_chains int[] NOT NULL DEFAULT '{}',
  controlled_wallet_ids text[] NOT NULL DEFAULT '{}',
  per_tx_limits jsonb NOT NULL DEFAULT '[]',
  period_limits jsonb NOT NULL DEFAULT '[]',
  period_hours int NOT NULL DEFAULT 24,
  approval_threshold jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending',
  frozen_at timestamptz,
  frozen_reason text,
  expires_at timestamptz NOT NULL,
  created_by_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE agent_tool_permissions (
  id text PRIMARY KEY,
  agent_id text NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tool text NOT NULL,
  UNIQUE (agent_id, tool)
);

CREATE TABLE agent_credentials (
  id text PRIMARY KEY,
  agent_id text NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  label text NOT NULL,
  prefix text NOT NULL,
  secret_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz
);

CREATE TABLE agent_requests (
  id text PRIMARY KEY,
  agent_id text NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  workspace_id text NOT NULL,
  tool text NOT NULL,
  outcome text NOT NULL,
  reason text NOT NULL,
  intent_id text,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_requests_idx ON agent_requests(agent_id, created_at DESC);

-- ───────────── policies & intents ─────────────
CREATE TABLE policies (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  priority int NOT NULL DEFAULT 100,
  active_version_id text,
  created_by_id text NOT NULL,
  updated_by_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE policy_versions (
  id text PRIMARY KEY,
  policy_id text NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  version int NOT NULL,
  config jsonb NOT NULL,
  change_note text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  based_on_id text,
  created_by_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  activated_by_id text,
  UNIQUE (policy_id, version)
);

CREATE TABLE policy_evaluations (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  intent_id text,
  policy_version_ids text[] NOT NULL DEFAULT '{}',
  params_hash text,
  input jsonb NOT NULL,
  results jsonb NOT NULL,
  decision text NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}',
  required_approvals int NOT NULL,
  simulated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX policy_eval_ws_idx ON policy_evaluations(workspace_id, created_at DESC);

CREATE TABLE spend_intents (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  wallet_id text NOT NULL,
  agent_id text,
  requested_by_user_id text,
  chain_id int NOT NULL,
  from_address text NOT NULL,
  to_address text NOT NULL,
  asset_type text NOT NULL,
  token_address text,
  asset_symbol text NOT NULL,
  decimals int NOT NULL,
  amount text NOT NULL,
  purpose text NOT NULL,
  reference text,
  evidence_note text,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  params_hash text NOT NULL,
  idempotency_key text NOT NULL,
  last_evaluation_id text,
  required_approvals int NOT NULL DEFAULT 0,
  counterparty_snapshot jsonb,
  unsigned_tx jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);
CREATE INDEX spend_intents_ws_idx ON spend_intents(workspace_id, status);

CREATE TABLE approvals (
  id text PRIMARY KEY,
  intent_id text NOT NULL REFERENCES spend_intents(id) ON DELETE CASCADE,
  approver_user_id text NOT NULL,
  decision text NOT NULL,
  reason text NOT NULL,
  params_hash text NOT NULL,
  invalidated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intent_id, approver_user_id, params_hash)
);

CREATE TABLE execution_attempts (
  id text PRIMARY KEY,
  intent_id text NOT NULL REFERENCES spend_intents(id) ON DELETE CASCADE,
  tx_hash text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  submitted_by_id text,
  block_number bigint,
  reconciliation text NOT NULL DEFAULT '',
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intent_id, tx_hash)
);

-- ───────────── incidents ─────────────
CREATE TABLE security_incidents (
  id text PRIMARY KEY,
  workspace_id text,
  scope text NOT NULL,
  type text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  assignee_user_id text,
  assignee_staff_id text,
  source_ref text,
  evidence jsonb NOT NULL DEFAULT '{}',
  resolution text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incidents_ws_idx ON security_incidents(workspace_id, status);
CREATE INDEX incidents_scope_idx ON security_incidents(scope, type);

CREATE TABLE incident_notes (
  id text PRIMARY KEY,
  incident_id text NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
  author_user_id text,
  author_staff_id text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ───────────── graph / knowledge / AI ─────────────
CREATE TABLE graph_sync_jobs (
  id text PRIMARY KEY,
  scan_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  vertices int NOT NULL DEFAULT 0,
  edges int NOT NULL DEFAULT 0,
  attempts int NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_documents (
  id text PRIMARY KEY,
  workspace_id text REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,
  source text NOT NULL,
  access_scope text NOT NULL DEFAULT 'members',
  retention_days int,
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'processing',
  version int NOT NULL DEFAULT 1,
  content_hash text NOT NULL,
  size_bytes int NOT NULL,
  error text,
  created_by_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE knowledge_chunks (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  workspace_id text,
  access_scope text NOT NULL,
  ordinal int NOT NULL,
  section text NOT NULL,
  content text NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', section || ' ' || content)) STORED,
  embedding vector,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_chunks_tsv_idx ON knowledge_chunks USING gin(tsv);
CREATE INDEX knowledge_chunks_ws_idx ON knowledge_chunks(workspace_id);

CREATE TABLE embedding_records (
  id text PRIMARY KEY,
  chunk_id text NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
  model text NOT NULL,
  dims int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE retrieval_logs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  user_id text,
  query text NOT NULL,
  mode text NOT NULL,
  chunk_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_conversations (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]',
  provider text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ───────────── audit & proofs ─────────────
CREATE TABLE audit_events (
  id text PRIMARY KEY,
  chain_key text NOT NULL,
  seq int NOT NULL,
  workspace_id text,
  actor_type text NOT NULL,
  actor_id text,
  actor_label text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  outcome text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  request_id text,
  prev_hash text NOT NULL,
  hash text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (chain_key, seq)
);
CREATE INDEX audit_ws_idx ON audit_events(workspace_id, created_at DESC);
CREATE INDEX audit_action_idx ON audit_events(action);

-- Append-only at the database level: no UPDATE / DELETE on audit rows.
CREATE OR REPLACE FUNCTION audit_events_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_immutable();

CREATE TABLE audit_checkpoints (
  id text PRIMARY KEY,
  chain_key text NOT NULL,
  from_seq int NOT NULL,
  to_seq int NOT NULL,
  head_hash text NOT NULL,
  event_count int NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE proof_anchors (
  id text PRIMARY KEY,
  workspace_id text,
  checkpoint_id text,
  kind text NOT NULL,
  batch_id text NOT NULL UNIQUE,
  commitment text NOT NULL,
  chain_id int,
  contract_address text,
  tx_hash text,
  block_number bigint,
  status text NOT NULL DEFAULT 'local',
  verification text NOT NULL DEFAULT '',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ───────────── notifications & webhooks ─────────────
CREATE TABLE notifications (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  delivery_status text NOT NULL DEFAULT 'delivered',
  ref_type text,
  ref_id text,
  read_by text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_ws_idx ON notifications(workspace_id, created_at DESC);

CREATE TABLE webhook_endpoints (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL,
  secret_enc text NOT NULL,
  secret_prefix text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_by_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz
);

CREATE TABLE webhook_deliveries (
  id text PRIMARY KEY,
  endpoint_id text NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_status_code int,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (endpoint_id, event_id)
);
CREATE INDEX webhook_deliveries_due_idx ON webhook_deliveries(status, next_attempt_at);

-- ───────────── billing ─────────────
CREATE TABLE plans (
  key text PRIMARY KEY,
  name text NOT NULL,
  price_monthly_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  entitlements jsonb NOT NULL,
  provider_product_id text,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE subscriptions (
  id text PRIMARY KEY,
  workspace_id text NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_key text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  provider text,
  provider_subscription_id text UNIQUE,
  provider_customer_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payment_events (
  id text PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL UNIQUE,
  type text NOT NULL,
  workspace_id text,
  amount_cents int,
  currency text,
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL,
  error text,
  event_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE usage_records (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  metric text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_idx ON usage_records(workspace_id, metric, created_at);

-- ───────────── platform ─────────────
CREATE TABLE integrations (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  enabled boolean NOT NULL DEFAULT true,
  endpoint_ref text NOT NULL,
  timeout_ms int NOT NULL DEFAULT 10000,
  retry_policy jsonb NOT NULL DEFAULT '{"retries":2,"backoffMs":500}',
  permitted_chains int[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'unknown',
  last_check_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_health_events (
  id text PRIMARY KEY,
  integration_key text NOT NULL,
  status text NOT NULL,
  latency_ms int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_health_idx ON provider_health_events(integration_key, created_at DESC);

CREATE TABLE api_keys (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label text NOT NULL,
  prefix text NOT NULL,
  secret_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_by_id text NOT NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_key_usage (
  id text PRIMARY KEY,
  api_key_id text NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  route text NOT NULL,
  status int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_staff_roles (
  key text PRIMARY KEY,
  name text NOT NULL,
  capabilities text[] NOT NULL
);

CREATE TABLE staff_users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  role_key text NOT NULL REFERENCES platform_staff_roles(key),
  scopes text[] NOT NULL DEFAULT '{}',
  mfa_secret_enc text,
  mfa_enabled boolean NOT NULL DEFAULT false,
  mfa_required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  access_expires_at timestamptz,
  justification text NOT NULL DEFAULT '',
  granted_by_id text,
  failed_logins int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff_sessions (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  staff_id text NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  ip text, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE feature_flags (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  enabled boolean NOT NULL DEFAULT false,
  rollout_scope text NOT NULL DEFAULT 'none',
  expires_at timestamptz,
  change_reason text NOT NULL DEFAULT '',
  updated_by_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE methodology_versions (
  id text PRIMARY KEY,
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  changes text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  reviewer text,
  effective_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE evaluation_runs (
  id text PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  methodology_version text NOT NULL,
  dataset text NOT NULL,
  run_at timestamptz NOT NULL,
  cases jsonb NOT NULL,
  results jsonb NOT NULL,
  per_rule jsonb NOT NULL DEFAULT '[]',
  limitations text[] NOT NULL DEFAULT '{}',
  artifact_url text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content_pages (
  id text PRIMARY KEY,
  slug text NOT NULL,
  version int NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  sources text[] NOT NULL DEFAULT '{}',
  reviewer text,
  effective_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_by_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

CREATE TABLE platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
