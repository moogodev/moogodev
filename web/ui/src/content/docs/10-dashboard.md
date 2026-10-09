# Dashboard

The dashboard is a full studio for your database: browse and edit rows as a
spreadsheet, build tables without writing migrations, run SQL in a console, and
watch what every request did.

It needs **no project key**. Your session cookie authorises it, because you are
the owner. This is the one place worth understanding before you start clicking.

## Why the dashboard does not ask for your key

The principle is that a secret key in a browser leaks. Devtools, a screenshot, or
a browser extension is enough, and once it is out there you have no way to know
how many copies exist.

That principle has an obvious consequence: the dashboard must not receive the key.

But there is a catch worth being honest about. The server stores only a **hash**
of your key, and a hash cannot be turned back into the key. So the server
genuinely cannot proxy requests to the database on your behalf. The two positions
cannot both be satisfied.

Moogo takes the position that keeps the key out of the browser, which means the
dashboard talks to the data plane using **your session**, and the server
authorises each request by checking that you own the project.

### What this means practically

- The dashboard works even if you have never seen your project key.
- SQL run in the dashboard console goes through **the same sanitizer and the same
  read/write rules** as the public API. Behaviour you see here is behaviour your
  application gets.
- If you rotate the key, the dashboard keeps working. Nothing to update.

## Pages

| Path | What it is |
|---|---|
| `/app` | Overview: your projects, usage, quick actions, and **What's new**. |
| `/app/projects` | All projects. |
| `/app/projects/{id}` | The project page — database, bucket, settings. |
| `/app/settings` | Account settings. |

The overview also carries **What's new**: the newest published posts from the
news service, as links. The list is public — the same posts appear on
news.moogo.dev — so it is re-served from this origin rather than fetched across
sites; a post shows up within a minute of publishing, in the same UTC dates the
news site uses. It is decoration: if the news service is down the widget is
empty and the rest of the dashboard is unaffected.

## The database tab

### Browse tables

Pick a table from the list and its rows appear as a spreadsheet. Sort, filter,
and page through them. This is the fastest way to check what your application
actually wrote.

For large tables, filtering by a prefix or a search string avoids loading
everything.

### Create a table

**Create table** opens a builder: name, columns, types, primary key, nullability,
and defaults. It generates the `CREATE TABLE` and runs it.

The same sanitizer applies, so a table or column name that trips a blocked keyword
is refused here too — the builder tells you what to change rather than failing
silently.

Use the builder rather than hand-writing DDL when you can: it produces
consistent naming and you cannot forget a comma.

### Edit rows

Add, edit, and delete rows directly in the spreadsheet. Each change runs as a
parameterised statement, so values are bound rather than interpolated.

Edits are **immediate** — there is no separate save step, and no transaction to
remember. That is convenient for exploration and risky for bulk work; take a
[backup](#download-a-backup) before a large edit.

### SQL console

Run any statement directly. The console shows results as a grid, and reports the
server-side duration.

- Reads go to `/query`, writes to `/exec`, chosen automatically.
- Rejections show the same error `code` and `detail` your application would get,
  which makes the console a good place to reproduce an error before fixing it.
- **Paste a whole script.** Several statements separated by `;` run one after
  another in order, each as its own request — the
  [one-statement rule](/docs/sql-api#one-statement-per-request) still applies per
  request. The batch stops at the first error; statements that already ran stay
  applied, because no transaction spans the batch.
- **Examples** below the editor load ready-made statements into the editor —
  schema, reads, writes, inspection. Nothing runs until you press Run.

## The bucket tab

Browse, upload, and organise files.

- **Upload** respects the bucket's policy, so a rejected file tells you why —
  wrong type or over the size cap.
- **Preview** renders images, video, audio, and text inline. Private files preview
  correctly because the dashboard uses its own session-scoped route rather than
  the credential-requiring URL.
- **Public** toggles whether an object is readable at a URL with no credential.
- **Credentials** manages [storage credentials](/docs/credentials) and shows each
  secret once on creation.

Renaming and deleting work on objects and on whole prefixes.

## Settings tab

Where [project management](/docs/create-project#managing-the-project) lives:
rotate key, pause, resume, delete, and download a backup.

### Download a backup

**Download backup** gives you the whole database as a `.db` file.

It uses your session, not a project key, so it works from the dashboard even if
you have lost the key.

Take one before anything destructive — a large edit through the spreadsheet, a
schema change, or a bulk delete. It is a full SQLite file, so you can open it with
any SQLite tooling.

## Activity log

Every request against your project is recorded with its method, path, status, and
duration. Use it to answer two questions: **what ran**, and **what it cost**.

A few things it is good for:

- Confirming a deployment is actually reaching the right project.
- Finding which query is slow, from the `duration` column.
- Spotting requests you do not recognise after rotating a key.
- Checking that a background job is still running.

It is kept for **7 days** and then pruned.

## Account settings

`/app/settings` shows your name, your email, and your plan, and lets you sign
out.

Your **email cannot be changed here**. It is how Moogo recognises you, and it has
to match the address on your Google account — if the two drifted apart, signing
in with Google would quietly create a second account.

**Password** depends on how you sign in:

- An email/password account gets a change form that asks for your current
  password before setting a new one. A stolen session cookie on its own cannot
  take the account over, because the cookie is not enough to replace the
  password.
- A Google-only account is told that its password lives at Google, with a link to
  Google account security. Moogo has never seen that password, so it cannot
  change or reset it, and it will not offer a form that would create a second
  credential Google does not know about.

Changing your password does not sign out your other sessions. The password is
the credential; sessions are tokens already issued, and changing one does not
reach back into the others. **Signing out is what revokes**: it bumps an epoch
on your account, and every session issued before that bump stops verifying —
on every device, not only the browser that clicked sign out. If you think a
session is compromised, sign out once from any device you still control, and
change the password with the provider you sign in with if the account has one.

**Plan** is read from your account, alongside what you are using against the
limits. There are no billing controls in this version — every account is on the
same plan — so **See plans** is there but inert.

**Danger zone** is the last section. **Delete account** removes the account and
everything under it — every project, database, stored object, and key — and
signs out every session, because a session that names no account cannot verify.
A password account must re-enter its password first, so a stolen cookie cannot
erase the account; a Google-only account confirms with its session alone. It is
a two-click confirmation with no undo: export anything you want to keep before
using it.

## Access rules

Ownership is checked on **every request**, not once at sign-in.

A project belonging to another account returns `404`, not `403`. That is
deliberate: a `403` confirms the project exists, which would turn the id in a URL
into a way to discover other people's projects. `404` tells you nothing.

Pausing a project stops the dashboard too, not just the API. Otherwise pausing
would appear to work while files kept changing.

## Next

- [Create a project](/docs/create-project) — settings in more detail
- [SQL API](/docs/sql-api) — what the console is calling
- [Security](/docs/security) — the model behind all of this