-- Weight section headings (A) above body text (B) so question-style headings rank first.
ALTER TABLE knowledge_chunks DROP COLUMN tsv;
ALTER TABLE knowledge_chunks ADD COLUMN tsv tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', section), 'A') || setweight(to_tsvector('english', content), 'B')) STORED;
CREATE INDEX knowledge_chunks_tsv_idx ON knowledge_chunks USING gin(tsv);
ALTER TABLE knowledge_documents ADD COLUMN slug text;
CREATE INDEX knowledge_documents_slug_idx ON knowledge_documents(slug) WHERE workspace_id IS NULL AND deleted_at IS NULL;
ALTER TABLE retrieval_logs ALTER COLUMN workspace_id DROP NOT NULL;
