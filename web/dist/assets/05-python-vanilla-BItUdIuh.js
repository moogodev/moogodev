var e=`# Python (Vanilla)

Works with stdlib only (Python 3.11+). No dependencies.

## Setup

\`\`\`bash
# Nothing to install
\`\`\`

**Environment variables:**

\`\`\`bash
# API origin (no path; the /p/<project-id>/... path is built in code).
export MOOGO_BASE_URL="https://api.moogo.dev"
export MOOGO_PROJECT_ID="8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0"
export MOOGO_SQL_KEY="moogo_..."
# Optional: origin public objects are served from; falls back to the API origin when empty.
export MOOGO_CDN_URL="https://cdn.moogo.dev"
export MOOGO_STORAGE_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_STORAGE_SECRET_KEY="moogo_sk_..."
\`\`\`

## Client (\`moogo.py\`)

\`\`\`python
# moogo.py
import os
import json
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import quote

BASE_URL = os.environ["MOOGO_BASE_URL"].rstrip("/")
PROJECT_ID = os.environ["MOOGO_PROJECT_ID"]
SQL_KEY = os.environ["MOOGO_SQL_KEY"]
PROJECT_URL = f"{BASE_URL}/p/{PROJECT_ID}"
BUCKET_ENDPOINT = f"{PROJECT_URL}/bucket"
# Optional CDN origin for public objects; falls back to the API origin when empty.
CDN_URL = os.environ.get("MOOGO_CDN_URL", "").rstrip("/")
BUCKET_ACCESS_KEY_ID = os.environ["MOOGO_STORAGE_ACCESS_KEY_ID"]
BUCKET_SECRET_KEY = os.environ["MOOGO_STORAGE_SECRET_KEY"]

SQL_HEADERS = {
    "Authorization": f"Bearer {SQL_KEY}",
    "Content-Type": "application/json",
}

STORAGE_HEADERS = {
    "X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID,
    "Authorization": f"Bearer {BUCKET_SECRET_KEY}",
}

def _error_from(exc: urllib.error.HTTPError) -> dict:
    # The error body is the same envelope the JSON guides parse by hand.
    try:
        return json.loads(exc.read()).get("error", {})
    except Exception:
        return {"code": f"http_{exc.code}", "message": exc.reason}


def _post(path: str, query: str, args: list[Any] = None) -> dict:
    args = args or []
    data = json.dumps({"query": query, "args": args}).encode()
    req = urllib.request.Request(
        f"{PROJECT_URL}{path}", data=data, headers=SQL_HEADERS, method="POST"
    )
    # urlopen raises on 4xx and 5xx rather than returning the response, so the
    # failure has to be caught here to become a MoogoError. Without this the
    # class below is never raised and the error handling in this guide catches
    # nothing.
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        raise MoogoError(_error_from(exc), exc.code) from exc

class MoogoError(Exception):
    def __init__(self, error: dict, status: int = None):
        self.code = error.get("code")
        self.message = error.get("message")
        self.detail = error.get("detail")
        # The HTTP status, so callers can branch on 401/403 and the like.
        self.status = status
        super().__init__(self.message)

def is_read(sql: str) -> bool:
    # \`with\` covers CTE reads (WITH ... SELECT); a CTE that writes
    # (WITH ... INSERT) must be sent to /exec directly.
    return sql.lstrip().upper().startswith(
        ("SELECT", "VALUES", "PRAGMA", "EXPLAIN", "WITH")
    )

def query(sql: str, args: list = None) -> dict:
    return _post("/query", sql, args)

def exec(sql: str, args: list = None) -> dict:
    return _post("/exec", sql, args)

def sql(sql: str, args: list = None) -> dict:
    return query(sql, args) if is_read(sql) else exec(sql, args)

def to_objects(result: dict) -> list[dict]:
    cols = result.get("columns", [])
    return [dict(zip(cols, row)) for row in result.get("rows", [])]

# ── Bucket ───────────────────────────────────────────────────────────
def _storage_request(method: str, path: str, body: bytes = None, headers: dict = None) -> dict:
    url = f"{BUCKET_ENDPOINT}{path}"
    h = {**STORAGE_HEADERS, **(headers or {})}
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status == 204:
                return {}
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        raise MoogoError(_error_from(exc)) from exc

def bucket_upload(key: str, data: bytes, content_type: str) -> dict:
    return _storage_request("POST", f"/{quote(key, safe='/')}", body=data, headers={"Content-Type": content_type})

def bucket_download(key: str) -> bytes:
    url = f"{BUCKET_ENDPOINT}/{quote(key, safe='/')}"
    req = urllib.request.Request(url, headers=STORAGE_HEADERS)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        raise MoogoError(_error_from(exc)) from exc

def bucket_delete(key: str) -> dict:
    return _storage_request("DELETE", f"/{quote(key, safe='/')}")

def bucket_list(prefix: str = None) -> dict:
    url = BUCKET_ENDPOINT
    if prefix:
        url += f"?prefix={quote(prefix, safe='')}"
    req = urllib.request.Request(url, headers=STORAGE_HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)

def bucket_publish(key: str) -> dict:
    body = json.dumps({"is_public": True}).encode()
    return _storage_request(
        "PATCH", f"/{quote(key, safe='/')}", body=body, headers={"Content-Type": "application/json"}
    )

def bucket_public_url(key: str) -> str:
    # /pub/<project-id>/<key> is the route that needs no credential. The bucket
    # endpoint is not it -- /p/<project-id>/bucket/<key> is the authenticated URL,
    # and a browser tab carries no storage credential, so an <img> pointed at one
    # breaks for every private object. This serves published objects only: a fresh
    # upload is private, so publish it with bucket_publish first. Until then,
    # Public objects are served
    # from the CDN origin (CDN_URL) when set, otherwise from the API origin.
    return f"{CDN_URL or BASE_URL}/pub/{PROJECT_ID}/{quote(key, safe='/')}"
\`\`\`

## Usage — SQLite

\`\`\`python
from moogo import sql, to_objects

sql("""
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now'))
  )
""")

import uuid
sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
    [str(uuid.uuid4()), "ketut@example.com", "pro"])

users = to_objects(sql("SELECT id, email, plan FROM users WHERE plan = ?", ["pro"]))
print(users)
# [{'id': '...', 'email': 'ketut@example.com', 'plan': 'pro'}, ...]
\`\`\`

## Usage — Bucket

\`\`\`python
from moogo import bucket_upload, bucket_download, bucket_delete, bucket_list, bucket_publish, bucket_public_url

# Upload
with open("avatar.png", "rb") as f:
    bucket_upload("avatars/kit.png", f.read(), "image/png")

# Download (private)
content = bucket_download("avatars/kit.png")

# List
objects = bucket_list("avatars/")["objects"]

# Publish, then read the public URL
bucket_publish("avatars/kit.png")
print(bucket_public_url("avatars/kit.png"))
\`\`\`

## Error handling

\`\`\`python
from moogo import sql, MoogoError

try:
    sql("SELECT * FROM nonexistent")
except MoogoError as e:
    if e.code == "sql_error":
        print("SQLite error:", e.detail)
    elif e.code == "database_too_large":
        print("Project hit 256 MB limit")
    elif hasattr(e, 'status') and e.status == 401:
        print("Invalid or rotated secret key")
    raise
\`\`\`

## Async version (aiohttp)

\`\`\`python
# moogo_async.py
import aiohttp
import os

PROJECT_URL = f"{os.environ['MOOGO_BASE_URL']}/p/{os.environ['MOOGO_PROJECT_ID']}"
SECRET_KEY = os.environ["MOOGO_SQL_KEY"]

HEADERS = {"Authorization": f"Bearer {SECRET_KEY}", "Content-Type": "application/json"}

async def sql(session: aiohttp.ClientSession, query: str, args: list = None) -> dict:
    args = args or []
    endpoint = (
        "/query"
        if query.lstrip().upper().startswith(
            ("SELECT", "VALUES", "PRAGMA", "EXPLAIN", "WITH")
        )
        else "/exec"
    )
    async with session.post(f"{PROJECT_URL}{endpoint}", headers=HEADERS, json={"query": query, "args": args}) as resp:
        body = await resp.json()
        if resp.status >= 400:
            raise MoogoError(body.get("error", {}))
        return body
\`\`\`

\`\`\`python
import asyncio
import aiohttp
from moogo_async import sql

async def main():
    async with aiohttp.ClientSession() as session:
        users = await sql(session, "SELECT id, email FROM users WHERE plan = ?", ["pro"])
        print(users)

asyncio.run(main())
\`\`\`

## Production Readiness ⚠️

- **SQL transactions**: Max 100 statements per \`/transaction\` and 15-second budget. Do not combine large DDL with intensive data manipulation in a single transaction.
- **Database size limit**: 256 MB per project. Database does not auto-shrink — delete rows progressively if approaching the limit, and monitor daily usage.
- **Sensitive column names**: Certain names (\`readfile\`, \`writefile\`, \`delete\`, \`vacuum\`, \`attach\`, \`detach\`, \`reindex\`, \`analyze\`, \`pragma\`) are blocked as column names in SQL queries.
- **Public object URLs**: \`public_url\` is a bearer token — cannot be revoked without rotating the key or unpublishing the object. Perform \`PATCH is_public: true\` after upload if you want to share without credentials.
- **Error handling**: Use \`error.code\` rather than \`error.message\` for safe branching (retryable vs non-retryable).

## Next

- [FastAPI guide](/docs/guides/fastapi)
- [Flask guide](/docs/guides/flask)
- [Django guide](/docs/guides/django)
- [SQL API reference](/docs/sql-api)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Object storage](/docs/object-storage)`;export{e as default};