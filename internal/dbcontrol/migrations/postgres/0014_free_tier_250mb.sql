-- 0014_free_tier_250mb.sql — the free tier moves to 250 MB.
--
-- 0001 and 0009 carry the old numbers (a 100 MB database, 256 MB of storage,
-- a 250 MB bucket default), and both are already recorded on every running
-- deployment. The migration runner refuses to re-run a file whose contents
-- changed after it applied, so the new numbers are added here rather than
-- edited into those two -- editing an applied migration is what that guard
-- exists to stop.
--
-- A free project holds 250 MB of SQLite and 250 MB of object storage, 500 MB
-- in all. An account with its two projects holds 1 GB.

-- --- Account quota ---
--
-- A column default only moves the next row written, so changing it leaves
-- every account already signed up where it was. Both halves follow.
ALTER TABLE users
    ALTER COLUMN quota_max_db_bytes SET DEFAULT 262144000,      -- 250 MiB
    ALTER COLUMN quota_max_storage_bytes SET DEFAULT 262144000; -- 250 MiB

-- The rows already here are moved behind a plan guard rather than blindly.
-- Every account is on 'free' today so the guard matches, and when a paid plan
-- arrives its quota is a decision someone made for that account: a migration
-- that re-priced every row would quietly undo it.
UPDATE users
   SET quota_max_db_bytes      = 262144000,
       quota_max_storage_bytes = 262144000
 WHERE billing_plan = 'free';

-- --- Per-bucket default, now under a lower project ceiling ---
--
-- The bucket default was 262144000, which sat under the 268435456 project
-- ceiling of its day. The ceiling is 262144000 now, so the old default would
-- let one bucket hold the whole project -- a number the dashboard would print
-- and the server would refuse to accept as any larger. New buckets start at
-- 247463936 (236 MiB) instead.
ALTER TABLE buckets
    ALTER COLUMN quota_bytes SET DEFAULT 247463936;

-- Existing buckets move with it only where their own contents still fit.
-- Lowering a quota below what a bucket already holds would leave a bucket that
-- refuses even a replace of a file it already has, which is a lockout with no
-- way out from the dashboard.
UPDATE buckets b
   SET quota_bytes = 247463936
 WHERE b.quota_bytes = 262144000
   AND COALESCE((SELECT SUM(o.size_bytes)
                   FROM bucket_objects o
                  WHERE o.bucket_id = b.id), 0) < 247463936;
