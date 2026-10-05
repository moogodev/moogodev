-- 0007_bucket_upload_policy.sql — per-bucket upload rules.
--
-- A bucket on R2 can restrict what may be uploaded to it. Moogo had no such
-- setting: every bucket accepted any file of any size, and the only ceiling was
-- the project-wide storage quota. A user publishing a website's assets wants a
-- bucket that only takes images, not one that silently accumulates a 200 MB
-- database dump uploaded by a script.
--
-- Both settings are advisory for the dashboard and enforced for everybody,
-- because the dashboard is not the only way in: the same rules have to hold for
-- an API client using a storage credential, or they are not a limit at all.

-- Which media a bucket accepts: 'any', 'image', 'video', or 'file'.
--
-- Default 'any' preserves the behaviour every existing bucket had, so this
-- migration cannot start refusing an upload that used to work.
ALTER TABLE buckets
    ADD COLUMN IF NOT EXISTS allowed_types text NOT NULL DEFAULT 'any';

-- The constraint rather than validation in Go alone: this is the value that
-- decides whether a write is allowed, and every writer has to agree on it. An
-- unexpected value would otherwise read as "nothing matches" and silently
-- refuse every upload into that bucket.
ALTER TABLE buckets
    DROP CONSTRAINT IF EXISTS buckets_allowed_types_chk;

ALTER TABLE buckets
    ADD CONSTRAINT buckets_allowed_types_chk
    CHECK (allowed_types IN ('any', 'image', 'video', 'file'));

-- The largest single object a bucket accepts, in bytes.
--
-- NULL means no per-object limit, which is the pre-migration behaviour. It is
-- nullable rather than defaulting to the project quota so that raising the
-- project quota later does not silently tighten or loosen a bucket the user
-- configured deliberately.
ALTER TABLE buckets
    ADD COLUMN IF NOT EXISTS max_object_size_bytes bigint;

-- A negative limit is meaningless and would compare false against every size,
-- quietly accepting everything, so the sign is refused here.
ALTER TABLE buckets
    DROP CONSTRAINT IF EXISTS buckets_max_object_size_chk;

ALTER TABLE buckets
    ADD CONSTRAINT buckets_max_object_size_chk
    CHECK (max_object_size_bytes IS NULL OR max_object_size_bytes > 0);
