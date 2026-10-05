-- 0006_bucket_object_public.sql — per-object public visibility and versioning.
--
-- R2-style object storage has a public/private switch on every object, and
-- every object carries a version that changes when its content does. Neither
-- existed: public_token was never written by any code path, so there was no way
-- to publish a single file, and there was no validator to revalidate a cached
-- download against.

-- Public visibility is per object, not per bucket, so a user can publish a
-- single image out of a bucket where everything else stays private.
--
-- Default false matters: an object that predates this migration, or one written
-- by a code path that forgets the flag, stays private. Failing closed is the
-- only safe default for something reachable without a credential.
ALTER TABLE bucket_objects
    ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Object version. Rotated on every successful upload and used as the HTTP
-- ETag, so re-uploading a key produces a different validator and a cached copy
-- is revalidated instead of being served stale.
--
-- It is deliberately separate from public_token. Visibility and versioning are
-- different questions, and making one column answer both means every code path
-- has to keep two invariants in step to stay consistent.
--
-- The default covers pre-existing rows: each gets its own random version, so no
-- two objects accidentally share a validator.
ALTER TABLE bucket_objects
    ADD COLUMN IF NOT EXISTS version uuid NOT NULL DEFAULT gen_random_uuid();

-- Backfill any object that already carried a token, so an object published by
-- an older build does not silently lose its public URL when this lands.
UPDATE bucket_objects
   SET is_public = true
 WHERE public_token IS NOT NULL;

-- The object browser lists one bucket at a time, ordered by key, and filters by
-- a key prefix. The existing (bucket_id, created_at DESC) index serves the old
-- newest-first listing; this one serves prefix navigation, which is what a
-- folder-shaped object browser actually asks for.
CREATE INDEX IF NOT EXISTS bucket_objects_bucket_key_idx
    ON bucket_objects (bucket_id, key);

-- The bucket sidebar aggregates object count and size per bucket, and the
-- public listing only needs published rows. The composite index above is
-- already the right access path for the aggregate; this one exists so the
-- published aggregate is proportional to published objects rather than to
-- everything stored.
CREATE INDEX IF NOT EXISTS bucket_objects_public_bucket_idx
    ON bucket_objects (bucket_id)
    WHERE is_public;