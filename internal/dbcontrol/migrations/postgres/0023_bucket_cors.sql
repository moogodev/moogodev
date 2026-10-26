-- 0023_bucket_cors.sql
ALTER TABLE buckets
    ADD COLUMN IF NOT EXISTS cors_origins text[] NOT NULL DEFAULT '{}';