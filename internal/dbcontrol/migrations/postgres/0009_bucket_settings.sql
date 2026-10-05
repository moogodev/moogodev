-- 0009_bucket_settings.sql -- bucket-level visibility, a multi-select upload
-- policy, and a per-bucket storage quota.
--
-- 0006 put visibility on the object and 0007 put a single allowed-types value on
-- the bucket. Both were half-built in a way the dashboard then had to work
-- around:
--
--   * SetBucketPublic fanned out across every object in a bucket and wrote
--     nowhere near the bucket itself, so uploads that landed afterwards were
--     private again. A bucket marked public stopped being public the moment
--     anything was uploaded into it.
--
--   * allowed_types could hold exactly one of any/image/video/file, so "images
--     and video" was not expressible. A bucket that wanted both had to accept
--     anything.
--
--   * There was no per-bucket storage limit at all. Only the project-wide quota
--     existed, so one bucket could consume the entire project and leave the
--     others unable to store anything.

-- --- Bucket visibility ---
--
-- The default for objects uploaded into this bucket from now on. It is not the
-- only thing that decides visibility: bucket_objects.is_public is still there,
-- and an object the user flipped individually keeps its own answer. This column
-- answers the question a bucket-level toggle in the settings page has to answer,
-- and the per-object column answers the question a row-level toggle asks.
--
-- Default false, matching 0006, because the two must agree for the migration to
-- be a no-op: any bucket whose objects are all private stays private.
ALTER TABLE buckets
    ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- --- Per-bucket storage quota ---
--
-- 250 MB. Smaller than the 268435456-byte project ceiling on purpose: a bucket
-- that could hold more than its project would be a setting that cannot be
-- honoured, and the dashboard would show a number the server then refuses.
--
-- NOT NULL with a default rather than NULL, because "no per-bucket limit" is not
-- a real product state here. The project quota already bounds storage, so a
-- bucket without a limit of its own is a bucket nobody configured.
ALTER TABLE buckets
    ADD COLUMN IF NOT EXISTS quota_bytes bigint NOT NULL DEFAULT 262144000;

-- A quota below or equal to zero refuses every upload, which looks identical to
-- a broken bucket rather than to a deliberate setting.
ALTER TABLE buckets
    DROP CONSTRAINT IF EXISTS buckets_quota_bytes_chk;

ALTER TABLE buckets
    ADD CONSTRAINT buckets_quota_bytes_chk CHECK (quota_bytes > 0);

-- --- allowed_types: one value becomes a set ---
--
-- The single column is replaced rather than added beside it, because two columns
-- answering the same question is how a row ends up claiming to be both
-- image-only and unrestricted.
--
-- The old column is dropped and the new one renamed into its place so no code
-- path can still read the scalar: a reader that forgets to migrate would
-- otherwise compile, silently read the stale value, and keep enforcing a policy
-- the user had already changed.
ALTER TABLE buckets
    ADD COLUMN IF NOT EXISTS allowed_types_next text[] NOT NULL DEFAULT ARRAY['any']::text[];

-- Every existing value becomes a one-element set, so a bucket set to 'image'
-- stays images-only across the migration. A row that predates 0007 and is NULL
-- or empty has no restriction, which is what ARRAY['any'] means.
UPDATE buckets
   SET allowed_types_next = ARRAY[allowed_types]::text[]
 WHERE allowed_types IS NOT NULL
   AND allowed_types <> '';

ALTER TABLE buckets
    DROP CONSTRAINT IF EXISTS buckets_allowed_types_chk;

ALTER TABLE buckets
    DROP COLUMN allowed_types;

ALTER TABLE buckets
    RENAME COLUMN allowed_types_next TO allowed_types;

-- Every element must be a known class, or a typo would match no upload and
-- quietly empty the bucket for good.
--
-- 'any' is the absence of a restriction, so it cannot be combined with a real
-- class: ARRAY['any','image'] is two contradictory instructions, and resolving
-- it by picking a winner means the answer depends on evaluation order. It is
-- refused here instead.
ALTER TABLE buckets
    ADD CONSTRAINT buckets_allowed_types_chk CHECK (
        cardinality(allowed_types) > 0
        AND allowed_types <@ ARRAY['any','image','video','audio','document','archive','file']::text[]
        AND (NOT 'any' = ANY (allowed_types) OR cardinality(allowed_types) = 1)
    );

-- The object browser groups and filters a bucket by its policy, and the settings
-- page lists buckets by visibility. Neither is on a hot path the object listing
-- dominates, but the bucket list runs on every dashboard load.
CREATE INDEX IF NOT EXISTS buckets_public_idx
    ON buckets (project_id)
    WHERE is_public;
