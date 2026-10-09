var e=`# Security

This page explains how Moogo is built to fail safely, and — just as importantly —
what the model does **not** protect you from.

## Multi-tenancy

Each project maps to one SQLite file:

\`\`\`
/data/dbs/{project_id}.db
/data/buckets/{project_id}/{key}
\`\`\`

Isolation comes from the filesystem, not from a policy. There is no shared table
and no \`tenant_id\` column to forget in a \`WHERE\` clause, because there is no
shared table.

### The path is validated, not trusted

\`project_id\` comes from a URL, and a URL is untrusted input. It is validated as a
UUID before anything else happens, and the on-disk path is then **rebuilt from the
validated components** rather than assembled from the raw string.

That is the structural reason path traversal is impossible here: there is no code
path where raw input becomes a path.

A malformed id returns \`400 invalid_project_id\` before any lookup happens.

### Ownership is checked per request

Ownership is verified on **every** request, not once at sign-in.

Another account's project returns \`404\`, not \`403\`. A \`403\` would confirm the
project exists, which turns the id in a URL into a way to enumerate other people's
projects. \`404\` tells an attacker nothing.

## Statement validation

Because \`/exec\` accepts DDL, it could otherwise become a primitive for reading the
host filesystem. Every statement is **tokenized and inspected before it runs**.

### Checked on tokens, not on text

Matching happens after tokenization, not with a substring search. This matters:
a table called \`attachments\` does not contain the keyword \`ATTACH\` as far as the
checker is concerned, because \`ATTACH\` appears as part of a longer identifier
rather than as a standalone word.

A naive \`strings.Contains(text, "ATTACH")\` would reject \`SELECT * FROM
attachments\`. The token-based check does not.

The exception is the blocked **function names**, which are matched anywhere they
appear — including as a column name. A column literally named \`readfile\` is
refused. That is a deliberate trade: a confusingly-named column is a far smaller
cost than a readable \`/etc/passwd\`.

### What is refused

| Category | Items |
|---|---|
| File access | \`ATTACH\`, \`DETACH\` |
| Whole-file rewrites | \`VACUUM\`, \`REINDEX\`, \`ANALYZE\` |
| Transaction control | \`BEGIN\`, \`COMMIT\`, \`ROLLBACK\`, \`SAVEPOINT\`, \`RELEASE\` |
| Filesystem builtins | \`readfile\`, \`writefile\`, \`load_extension\`, \`edit\`, \`fts3_tokenizer\`, \`sqlite_compileoption_get\`, \`sqlite_compileoption_used\` |
| Triggers | \`CREATE TRIGGER\` |
| File-writing pragmas | Anything not on the [allowlist](/docs/sql-api#pragma) |

\`ATTACH\` is the important one: it opens an arbitrary path as a database, which
would turn the write endpoint into a file reader for the entire host.

\`PRAGMA\` is **allowlisted rather than blocked**, because many pragmas write to the
file (\`journal_mode\`, \`key\`, \`rekey\`, \`page_size\`, \`auto_vacuum\`,
\`synchronous\`) and a blocklist would have to anticipate all of them.

### Triggers are declined on purpose

A trigger body sits between \`BEGIN\` and \`END\` and contains semicolons, so
distinguishing its semicolons from a stacked statement needs a real parser that
tracks nesting. A hand-rolled approximation is exactly the kind of check that
fails open on input SQLite accepts but the code does not.

Triggers are declined rather than shipping a check that might be wrong. Write your
invariants in application code.

## Prepared statements only

Values are always bound parameters:

\`\`\`json
{ "query": "SELECT id FROM users WHERE email = ?", "args": ["ketut@example.com"] }
\`\`\`

The engine only ever sees a parameterised statement, so **a value can never become
syntax**. This is not "injection mostly prevented" — on this path it is
structurally impossible.

Unknown JSON fields are rejected rather than ignored. A client sending
\`{"argz": [...]}\` gets an error, not a success that silently did nothing.

## Secret storage

| Credential | Stored |
|---|---|
| Project key | SHA-256 hash + 8-character prefix |
| Storage secret | SHA-256 hash + 6-character preview |
| Password | Salted hash |

Plaintext appears in exactly one response — the create or rotate that issued it —
and is never recoverable afterwards.

Hash comparison is **constant-time**, so verification does not leak how many bytes
matched.

The practical test: a dump of the control plane database yields hashes, not
working credentials. Because the keys are not recoverable in the first place,
there is nothing for an attacker to reverse.

Unsalted SHA-256 is correct for these hashes specifically: the secret already has
256 bits of entropy from \`crypto/rand\`, so there is no guessing space for a salt
to close.

## Credentials are scoped

A project key runs SQL. A storage credential moves files. The dashboard uses a
session. **None of them works for the others.**

This is not bureaucracy. A key scoped to running \`SELECT\` should not be able to
overwrite every file in a project, and rotating the SQL key should not silently
break every running application.

## Sessions can be revoked

A dashboard session is a signed token that carries an **epoch** — a counter
stored on the account. Every authenticated request compares the token's epoch
against the account's current one, and a mismatch fails closed: no matching
row, no session.

**Sign out bumps the epoch.** One click from any device retires every session
the account holds, everywhere at once. The other browsers never need to be
reached; their tokens simply stop verifying on the next request.

Deleting the account is the same failure from the other direction: there is no
account left to read an epoch from, so every session signed in to it fails.

## Public object URLs

A published object is readable at \`/pub/{project_id}/{key}\` with no credential, no
session, and no cookie.

A **private** object returns \`404\` there — not \`403\` — so it is indistinguishable
from one that does not exist. Someone guessing keys learns nothing from the
response.

Understand what publishing means before you do it: **a public URL is a bearer
token.** Anyone with the link has the file, and you cannot make it private again
without changing the URL.

## Response headers

Every response carries:

| Header | Value |
|---|---|
| \`Content-Security-Policy\` | \`default-src 'self'\`; no inline scripts, own origin for frames and connections; images from own origin, \`data:\`, or \`https:\` |
| \`X-Content-Type-Options\` | \`nosniff\` |
| \`X-Frame-Options\` | \`DENY\` |
| \`Referrer-Policy\` | \`strict-origin-when-cross-origin\` |
| \`Strict-Transport-Security\` | Over HTTPS only |
| \`Cache-Control\` | \`no-store\` on \`/api/\`, \`/p/\`, \`/db/\`, \`/bucket/\`, \`/auth/\` |

\`no-store\` matters because the dashboard shows secret material on create and
rotate. A cached response body would hand it to whoever asked next.

HSTS is only sent over HTTPS, so local development over plain HTTP does not leave
a browser refusing to reach the site afterwards.

## Error messages

Errors do not leak internals.

\`detail\` on a SQL error carries the driver's message, which can name tables and
columns — useful to you, and revealing nothing about the host. Internal failures
return a generic message, and a panic returns nothing useful at all.

## What this model does not protect

Being clear about this is more useful than a reassuring summary.

- **A leaked key works.** If your project key is compromised, the attacker has your
  database until you rotate. There is no IP allowlist, no per-IP rate limit at the
  application layer, and no way to restrict a key to an IP. Rotation is the
  mitigation, and it is fast.
- **Public URLs cannot be revoked.** Only the URL containing them can change.
- **Nothing is encrypted at rest.** The database file and stored objects are
  plaintext on disk. Protection here depends on host and disk-level access control.
- **There is no multi-factor authentication.** One email and a password is the
  whole account security model.
- **Rate limits are ceilings, not traffic shaping.** The data plane allows 300
  requests a minute — queries keyed per project, storage operations per client
  address — enough to stop a runaway client or a stolen key from saturating the
  host, not enough to shape ordinary use. The sign-in endpoints
  (\`/auth/login\`, \`/auth/register\`, \`/auth/forgot-password\`,
  \`/auth/reset-password\`, \`/auth/verify-email\`, \`/auth/resend-verification\`)
  share 10 attempts a minute per client address, because they are the ones an
  unauthenticated caller can hammer. The public update list the dashboard
  reads, \`GET /api/updates\`, gets 60 a minute per address instead — public,
  but every call can spend up to three seconds waiting on the news service —
  and serves a minute-old cached answer, so the news service sees at most one
  fetch a minute. A \`429\` carries a \`Retry-After\` header.
- **SQLite writes are serialised per project.** This is a property of the engine,
  not something Moogo configures away. High write concurrency will queue.

## Running behind a proxy

If the deployment sits behind a reverse proxy — Caddy, nginx, a load balancer —
then \`MOOGO_TRUSTED_PROXIES\` should list that proxy's address:

\`\`\`
MOOGO_TRUSTED_PROXIES=127.0.0.1,::1
\`\`\`

Without it, every request looks like it came from the proxy, so a per-client
limit would treat all visitors as one caller and a shared bucket would lock
everyone out at once.

It is a list of addresses or CIDR ranges — \`127.0.0.1\` and \`10.0.0.0/24\` are
both valid entries. Moogo believes \`X-Forwarded-For\` only when the request
itself arrives from one of them; from anybody else the header is ignored, so a
client cannot pick its own identity to slip past a limit or poison the access
log. When the header is believed, the chain inside it is read right to left
past the listed proxies, so an entry the client sent itself cannot outweigh
the address a proxy appended. Do not list \`0.0.0.0\` or \`::\` — that is the
same as trusting everybody.

## Reporting a vulnerability

If you find something that looks wrong, please
[report it](/docs/feedback). Security reports are handled as priority, and you
will get an acknowledgement.`;export{e as default};