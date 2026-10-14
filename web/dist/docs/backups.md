# Backups

Moogo keeps an off-site copy of every project's database in **Cloudflare R2**,
taken on a schedule and restorable from the dashboard in one click. Backups are
there for the failures a running server cannot fix: a mistaken `DROP TABLE`, a
bulk edit that went wrong, or a database that will not open.

## What is backed up

The **database** is what gets copied — the whole SQLite file, tables, indexes
and all. Bucket **objects are not** part of a backup: they live separately and a
restore never touches them. If you need object history, that is a different
problem and R2's own versioning is the place for it.

Each backup is a consistent snapshot taken with SQLite's own `VACUUM INTO`, not a
copy of the file on disk. That matters because a live database has a write-ahead
log beside it: copying the `.db` file alone can capture a state that never
existed. The snapshot is a single self-contained file that opens in any SQLite
tool.

## Where backups are stored

Backups go to a **private Cloudflare R2 bucket**, over the S3-compatible API. R2
is object storage, so a backup is just an object with a key; nothing about the
bucket has to match your Moogo account, and the storage is billed by Cloudflare,
not by Moogo.

Each project has its own folder, and the key says why the copy exists:

```
<prefix>/<project-id>/daily/2026-10-14.sqlite   the scheduled daily backup
<prefix>/<project-id>/latest.sqlite             a copy of the newest one
<prefix>/<project-id>/manual/<time>.sqlite      taken by hand
<prefix>/<project-id>/pre-restore/<time>.sqlite taken just before a restore
<prefix>/<project-id>/initial/<time>.sqlite     the empty database at creation
```

The bucket must stay **private**. Moogo does not add its own encryption — it
relies on the bucket's access control — so a public bucket would expose every
project's database to anyone who can guess a key.

## Automatic backups

A background job looks for projects that are due and backs them up. A project is
due when it has never been backed up, or when its newest backup is older than the
backup window (24 hours by default).

To avoid storing identical copies, a backup is **skipped when nothing has
changed**: if the database file has not been written to since the last successful
backup, the stored copy is already current and there is nothing to upload.

The schedule is forgiving by design. The job runs on an interval, and a project
is picked up on the first pass after it becomes due — so a restart does not lose
a day of backups, it only delays them by at most one interval.

## Take a backup now

Open the **Backups** tab on a project and press **Back up now**. The snapshot is
taken and uploaded while you wait, and appears at the top of the list when it
finishes.

A new project is backed up once as soon as it is created, so the earliest restore
point is the state the project started in.

## Restore a backup

Pick a backup in the list and press **Restore**. This is destructive — the
project's current database is replaced by the snapshot — so it asks for
confirmation first.

A restore is **reversible**. Before anything is replaced, Moogo takes a
pre-restore snapshot of the current database and uploads it. If that snapshot
fails, the restore stops and the live database is left alone. The entry shows up
in the list as **Before restore**, so undoing a restore is just another restore.

The downloaded snapshot is checked against the size and checksum recorded when it
was uploaded. A backup that does not match is refused rather than installed: it
is better to keep a working database than to overwrite it with a truncated one.

Restoring works even while a project is **paused**. A paused or misbehaving
project is exactly the one whose owner may need to roll it back.

## Retention

Backups older than the retention window (30 days by default) are pruned from the
bucket. The **newest backup of a project is always kept**, so pruning can never
leave a project with no restore point.

When a project or an account is deleted, its stored backups are removed with it.

## Enabling backups

Backups are turned on by the operator, not the account, with the `MOOGO_BACKUP_*`
environment variables: the endpoint, bucket, and credentials of an S3-compatible
store. The reference — and the only target Moogo is tested against — is
**Cloudflare R2**. The
[`.env.example`](https://github.com/moogodev/moogodev/blob/main/.env.example)
lists every key and the steps for creating the R2 bucket and its API token.

When backups are not configured, the Backups tab says so plainly instead of
offering buttons that could only fail.

## Next

- [Dashboard](/docs/dashboard) — the other project tabs
- [Security](/docs/security) — how access to your data is scoped
- [Limits](/docs/limits) — quotas that apply per project
