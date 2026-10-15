# Backups

Moogo keeps an off-site copy of every project's database, taken on a schedule and
restorable from the dashboard in one click. Backups are there for the failures a
running server cannot fix: a mistaken `DROP TABLE`, a bulk edit that went wrong,
or a database that will not open.

## What is backed up

The **database** is what gets copied — the whole SQLite file, tables, indexes
and all. Bucket **objects are not** part of a backup: they live separately and a
restore never touches them. If you need object history or versioning, that is a
separate concern from database backups.

Each backup is a complete, consistent copy of the database at the moment it was
taken, and it is a single file that opens in any SQLite tool.

## Automatic backups

A backup runs about once a day, and a new project is backed up once as soon as it
is created, so the earliest restore point is the state the project started in.

To avoid storing identical copies, a backup is **skipped when nothing has
changed**: if the database has not been touched since the last backup, the
stored copy is already current and nothing new is uploaded.

## Backups are checked

A backup is only worth having if it can be restored, so Moogo periodically checks
each project's newest backup end to end: the copy must match what was stored
when it was taken, and it must pass an integrity check. This catches a damaged
or incomplete copy before you ever need it.

The **Backups** tab shows when the newest backup was last verified. If a check
fails, Moogo says so there, and taking a fresh backup — or restoring from a
different point in the list — is the way forward.

## Take a backup now

Open the **Backups** tab on a project and press **Back up now**. The snapshot is
taken and uploaded, and appears at the top of the list when it finishes.

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

## Download, open and delete a backup

Besides **Restore**, every row in the list has three more actions.

**Download** saves the snapshot as a SQLite file on your computer, named after
the project, the reason the backup was taken and its date — for example
`my-project_daily_14_10_2026.sqlite`. The file opens in any SQLite tool. It is
served from the same copy that a restore would use, checked against the recorded
size and checksum, so a download that finished is a file that is intact.

**Open** shows the backup in a new tab as a **read-only** browser: the same
tables, columns and rows the live **Tables** tab shows, with paging, but nothing
can be changed. No row can be edited and no table can be created, renamed or
dropped. It is a way to look inside a snapshot — to find the row a bad edit
touched, or to check that a restore would bring back what you expect — without
restoring anything. The snapshot is fetched and cached on the server the first
time you open it, so a very large backup can take a moment to appear.

**Delete** removes one backup permanently, after a confirmation. It cannot be
undone and there is no way to get that copy back, so reach for it only when you
no longer want it.

## Retention

Backups older than the retention window (30 days by default) are removed
automatically. The **newest backup of a project is always kept**, so you always
have at least one point to restore to.

When a project or an account is deleted, its backups are removed with it.

## Next

- [Dashboard](/docs/dashboard) — the other project tabs
- [Security](/docs/security) — how access to your data is scoped
- [Limits](/docs/limits) — quotas that apply per project
