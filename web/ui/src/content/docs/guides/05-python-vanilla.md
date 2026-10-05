# Python (Vanilla)

Works with stdlib only (Python 3.11+). No dependencies.

## Setup

```bash
# Nothing to install
```

**Environment variables:**

```bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
```

## Client (`moogo.py`)

```python
# moogo.py
import os
import json
import urllib.request
from typing import Any

PROJECT_URL = os.environ["MOOGO_PROJECT_URL"]
SECRET_KEY = os.environ["MOOGO_SECRET_KEY"]
BUCKET_ENDPOINT = os.environ["MOOGO_BUCKET_ENDPOINT"]
BUCKET_ACCESS_KEY_ID = os.environ["MOOGO_BUCKET_ACCESS_KEY_ID"]
BUCKET_SECRET_KEY = os.environ["MOOGO_BUCKET_SECRET_KEY"]

SQL_HEADERS = {
    "Authorization": f"Bearer {SECRET_KEY}",
    "Content-Type": "application/json",
}

STORAGE_HEADERS = {
    "X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID,
    "Authorization": f"Bearer {BUCKET_SECRET_KEY}",
}

def _post(path: str, query: str, args: list[Any] = None) -> dict:
    args = args or []
    data = json.dumps({"query": query, "args": args}).encode()
    req = urllib.request.Request(
        f"{PROJECT_URL}{path}", data=data, headers=SQL_HEADERS, method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        body = json.load(resp)
    if resp.status >= 400:
        raise MoogoError(body.get("error", {}))
    return body

class MoogoError(Exception):
    def __init__(self, error: dict):
        self.code = error.get("code")
        self.message = error.get("message")
        self.detail = error.get("detail")
        super().__init__(self.message)

def is_read(sql: str) -> bool:
    return sql.lstrip().upper().startswith(("SELECT", "VALUES", "PRAGMA", "EXPLAIN"))

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
    with urllib.request.urlopen(req) as resp:
        if resp.status == 204:
            return {}
        return json.load(resp)

def bucket_upload(key: str, data: bytes, content_type: str) -> dict:
    return _storage_request("POST", f"/{key}", body=data, headers={"Content-Type": content_type})

def bucket_download(key: str) -> bytes:
    url = f"{BUCKET_ENDPOINT}/{key}"
    req = urllib.request.Request(url, headers=STORAGE_HEADERS)
    with urllib.request.urlopen(req) as resp:
        return resp.read()

def bucket_delete(key: str) -> dict:
    return _storage_request("DELETE", f"/{key}")

def bucket_list(prefix: str = None) -> dict:
    url = BUCKET_ENDPOINT
    if prefix:
        url += f"?prefix={prefix}"
    req = urllib.request.Request(url, headers=STORAGE_HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)

def bucket_public_url(key: str) -> str:
    return f"{BUCKET_ENDPOINT}/{key}"
```

## Usage — SQLite

```python
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
```

## Usage — Bucket

```python
from moogo import bucket_upload, bucket_download, bucket_delete, bucket_list, bucket_public_url

# Upload
with open("avatar.png", "rb") as f:
    bucket_upload("avatars/kit.png", f.read(), "image/png")

# Download (private)
content = bucket_download("avatars/kit.png")

# List
objects = bucket_list("avatars/")["objects"]

# Public URL
print(bucket_public_url("public/logo.png"))
```

## Error handling

```python
from moogo import sql, MoogoError

try:
    sql("SELECT * FROM nonexistent")
except MoogoError as e:
    if e.code == "sql_error":
        print("SQLite error:", e.detail)
    elif e.code == "database_too_large":
        print("Project hit 100 MB limit")
    elif hasattr(e, 'status') and e.status == 401:
        print("Invalid or rotated secret key")
    raise
```

## Async version (aiohttp)

```python
# moogo_async.py
import aiohttp
import os

PROJECT_URL = os.environ["MOOGO_PROJECT_URL"]
SECRET_KEY = os.environ["MOOGO_SECRET_KEY"]

HEADERS = {"Authorization": f"Bearer {SECRET_KEY}", "Content-Type": "application/json"}

async def sql(session: aiohttp.ClientSession, query: str, args: list = None) -> dict:
    args = args or []
    endpoint = "/query" if query.lstrip().upper().startswith(("SELECT", "VALUES", "PRAGMA", "EXPLAIN")) else "/exec"
    async with session.post(f"{PROJECT_URL}{endpoint}", headers=HEADERS, json={"query": query, "args": args}) as resp:
        body = await resp.json()
        if resp.status >= 400:
            raise MoogoError(body.get("error", {}))
        return body
```

```python
import asyncio
import aiohttp
from moogo_async import sql

async def main():
    async with aiohttp.ClientSession() as session:
        users = await sql(session, "SELECT id, email FROM users WHERE plan = ?", ["pro"])
        print(users)

asyncio.run(main())
```

## Next

- [FastAPI guide](/docs/guides/fastapi)
- [Flask guide](/docs/guides/flask)
- [Django guide](/docs/guides/django)
- [SQL API reference](/docs/sql-api)
- [Object storage](/docs/object-storage)