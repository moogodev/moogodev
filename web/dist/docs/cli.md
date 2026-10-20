# Command line client

`moogo` is the command line client for the API: it carries your project's URL
and credentials and makes the same HTTP requests you would make with curl. It
opens no database and reads no file on the server — if the API will not do it,
the client will not do it either.

## Install

### Install script (recommended)

The fastest way. Works on macOS and Linux. Detects your OS and architecture, downloads the correct prebuilt binary from GitHub Releases, and installs it to `/usr/local/bin` or `~/.local/bin`.

```bash
curl -fsSL https://get.moogo.dev | sh
```

After installation, verify it:

```bash
moogo version
moogo help
```

### Install with Go

If you already have [Go](https://go.dev) installed:

```bash
go install github.com/moogodev/moogodev/cmd/moogo@latest
```

> `go install` requires Go on your machine and builds from source. The install script above does **not** require Go.

Or build it from a checkout:

```bash
git clone https://github.com/moogodev/moogodev
cd moogodev
go build ./cmd/moogo
```

`moogo version` prints the build you are running.

## Configuration

Every value comes from a flag or, when the flag is not given, from the
environment. The flag wins, so one command can address another project without
unsettling what the rest of your shell has exported.

| Variable | Flag | Needed by |
|---|---|---|
| `MOOGO_PROJECT_URL` | `--url` | every command — the project URL the dashboard shows |
| `MOOGO_SECRET_KEY` | `--key` | `db` commands |
| `MOOGO_BUCKET_ACCESS_KEY_ID` | `--storage-key-id` | `bucket` commands |
| `MOOGO_BUCKET_SECRET_KEY` | `--storage-key` | `bucket` commands |

```bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0"
export MOOGO_SECRET_KEY="moogo_..."
```

The two bucket variables are a [storage credential](/docs/credentials), which is
a different credential from the project key: object storage does not accept the
project key, and the project key does not accept a storage credential. Make one
under **Buckets → Access keys** in the dashboard.

## Apply a file

```bash
moogo db push schema.sql
```

The file is applied as one transaction, so it lands whole or not at all, and a
statement the API refuses names itself in the error (`statement 3`).

Only write statements belong here. A `SELECT` sent to the transaction endpoint
answers `not_a_write`, because reads go to `/query` — the same division the
API holds for every client.

A file of more than 100 statements — the cap the API puts on one transaction —
is applied in several transactions, in file order, and the summary says how
many.

`-` reads the SQL from standard input:

```bash
cat schema.sql | moogo db push -
```

## Seed once

```bash
moogo db seed
```

Applies `seed.sql`, or a path you pass instead, and records the file's content
hash in the project's database — in the same transaction as the seed itself, so
a seed that ran cannot fail to be recorded. Running it again with the same
content does nothing; change the file and it runs again.

```bash
moogo db seed fixtures.sql     # a path other than seed.sql
moogo db seed --force          # run it again regardless
cat seed.sql | moogo db seed - # recorded as one seed named "stdin"
```

The record lives in a table called `_moogo_seed`, which is reserved for this
purpose and is dropped along with everything else by `moogo db reset`.

## Reset a database

```bash
moogo db reset --yes
```

Drops every table and view and leaves the project with an empty database. It
asks for `--yes` because it cannot be undone: a [backup](/docs/backups) taken
before this is the only way back.

Foreign keys are honoured, so tables are dropped in dependency order and a
schema that points at itself in several places still resets cleanly.

## List objects

```bash
moogo bucket ls                # the default bucket
moogo bucket ls --bucket media # another bucket
moogo bucket ls avatars/       # only the keys under a prefix
```

Columns are key, size, content type and when the object was last changed. The
command follows the listing to its end on its own; add `--limit 50` to stop
after fifty (the last line then prints the cursor to continue with) or `--json`
to print the API's own answer for a script to read.

## Delete objects

```bash
moogo bucket rm avatars/ada.png
moogo bucket rm a.png b.png c.png
moogo bucket rm --prefix avatars
```

A delete without `--prefix` removes exactly the keys you name and nothing else.
`--prefix` is what makes it a folder delete: everything under that prefix goes.

## Errors and exit codes

An answer the API refused reaches the terminal in its own words, with the code
the documentation uses:

```
moogo: object not found (404 not_found) [request req_8f2c…]
```

| Exit code | Meaning |
|---|---|
| `0` | the command did its work |
| `1` | the API or the filesystem refused something |
| `2` | the command line itself was wrong — an unknown command, a missing variable, a flag without its value |

Exit code `2` is checked before any request is sent, so a script that runs with
an unfinished environment fails at once instead of failing at the API.

## What the client will not do

There is nothing in this tool that the API does not already offer. It sends
`POST /query`, `/exec` and `/transaction` and the object routes, with your
credentials in the headers, and every limit, rule and audit those routes apply
to anyone else applies to it. It cannot reach around the sanitizer, and there is
no configuration that would let it.

## Next

- [SQL API](/docs/sql-api) — what the two endpoints accept
- [Object storage](/docs/object-storage) — keys, buckets and signed links
- [Credentials](/docs/credentials) — which key opens which door
- [Errors](/docs/errors) — the codes a client can answer with
