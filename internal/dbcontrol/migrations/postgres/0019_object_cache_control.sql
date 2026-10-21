-- 0019_object_cache_control.sql — allow per-object Cache-Control override on upload.
ALTER TABLE bucket_objects ADD COLUMN IF NOT EXISTS cache_control TEXT;
