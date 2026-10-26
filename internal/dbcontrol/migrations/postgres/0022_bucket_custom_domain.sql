-- 0022_bucket_custom_domain.sql
ALTER TABLE buckets
    ADD COLUMN IF NOT EXISTS custom_domain text NOT NULL DEFAULT '';