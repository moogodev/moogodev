-- 0024_bucket_namespace_isolation.sql — UNIQUE(bucket_id, key).
--
-- Objects are unique per bucket, not per project. A file can live in two
-- buckets within the same project without conflict: different buckets have
-- different isolation boundaries, so the unique constraint correctly reflects
-- that.
ALTER TABLE bucket_objects
    DROP CONSTRAINT IF EXISTS bucket_objects_project_key_key,
    ADD CONSTRAINT bucket_objects_bucket_key_key
        UNIQUE (bucket_id, key);
