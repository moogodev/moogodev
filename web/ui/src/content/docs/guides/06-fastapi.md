# FastAPI

Modern, fast (Starlette + Pydantic), async-first.

## Setup

```bash
pip install fastapi uvicorn httpx pydantic
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
import httpx
from typing import Any
from urllib.parse import quote

PROJECT_URL = os.environ["MOOGO_PROJECT_URL"]
SECRET_KEY = os.environ["MOOGO_SECRET_KEY"]
BUCKET_ENDPOINT = os.environ["MOOGO_BUCKET_ENDPOINT"]
BUCKET_ACCESS_KEY_ID = os.environ["MOOGO_BUCKET_ACCESS_KEY_ID"]
BUCKET_SECRET_KEY = os.environ["MOOGO_BUCKET_SECRET_KEY"]

SQL_HEADERS = {"Authorization": f"Bearer {SECRET_KEY}", "Content-Type": "application/json"}
STORAGE_HEADERS = {"X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID, "Authorization": f"Bearer {BUCKET_SECRET_KEY}"}

client = httpx.AsyncClient(timeout=30.0)

def is_read(sql: str) -> bool:
    # `with` covers CTE reads (WITH ... SELECT); a CTE that writes
    # (WITH ... INSERT) must be sent to /exec directly.
    return sql.lstrip().upper().startswith(
        ("SELECT", "VALUES", "PRAGMA", "EXPLAIN", "WITH")
    )

async def _post(path: str, query: str, args: list[Any] = None) -> dict:
    args = args or []
    resp = await client.post(f"{PROJECT_URL}{path}", headers=SQL_HEADERS, json={"query": query, "args": args})
    body = resp.json()
    if resp.status_code >= 400:
        raise MoogoError(body.get("error", {}))
    return body

class MoogoError(Exception):
    def __init__(self, error: dict):
        self.code = error.get("code")
        self.message = error.get("message")
        self.detail = error.get("detail")
        super().__init__(self.message)

async def query(sql: str, args: list = None) -> dict:
    return await _post("/query", sql, args)

async def exec(sql: str, args: list = None) -> dict:
    return await _post("/exec", sql, args)

async def sql(sql: str, args: list = None) -> dict:
    return await query(sql, args) if is_read(sql) else await exec(sql, args)

def to_objects(result: dict) -> list[dict]:
    cols = result.get("columns", [])
    return [dict(zip(cols, row)) for row in result.get("rows", [])]

# ── Bucket ───────────────────────────────────────────────────────────
async def bucket_upload(key: str, content: bytes, content_type: str) -> dict:
    resp = await client.post(f"{BUCKET_ENDPOINT}/{quote(key, safe='/')}", headers={**STORAGE_HEADERS, "Content-Type": content_type}, content=content)
    return resp.json()

async def bucket_download(key: str) -> bytes:
    resp = await client.get(f"{BUCKET_ENDPOINT}/{quote(key, safe='/')}", headers=STORAGE_HEADERS)
    return resp.content

async def bucket_delete(key: str) -> dict:
    resp = await client.delete(f"{BUCKET_ENDPOINT}/{quote(key, safe='/')}", headers=STORAGE_HEADERS)
    return resp.json()

async def bucket_list(prefix: str = None) -> dict:
    url = BUCKET_ENDPOINT
    if prefix:
        url += f"?prefix={prefix}"
    resp = await client.get(url, headers=STORAGE_HEADERS)
    return resp.json()

def bucket_public_url(key: str) -> str:
    # /pub/<project-id>/<key> is the route that needs no credential. The bucket
    # endpoint is not it -- /p/<project-id>/bucket/<key> is the authenticated URL,
    # and a browser tab carries no storage credential, so an <img> pointed at one
    # breaks for every private object. This serves published objects only: until
    # you publish, public_url in the response is an empty string.
    origin, _, tail = BUCKET_ENDPOINT.partition("/p/")
    project_id = tail.split("/")[0]
    return f"{origin}/pub/{project_id}/{quote(key, safe='/')}"
```

## FastAPI App (`main.py`)

```python
# main.py
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from moogo import (
    client,
    sql,
    to_objects,
    bucket_upload,
    bucket_public_url,
    MoogoError,
)
import uuid

app = FastAPI(title="Moogo + FastAPI")

class UserIn(BaseModel):
    email: str
    plan: str = "free"

class UserOut(BaseModel):
    id: str
    email: str
    plan: str

@app.on_event("shutdown")
async def shutdown():
    # client is the module-level httpx.AsyncClient from moogo.py, not a module:
    # moogo.client would be an attribute lookup on a name that does not exist.
    await client.aclose()

@app.get("/users", response_model=list[UserOut])
async def list_users():
    return to_objects(await sql("SELECT id, email, plan FROM users"))

@app.post("/users", response_model=UserOut, status_code=201)
async def create_user(user: UserIn):
    try:
        user_id = str(uuid.uuid4())
        await sql(
            "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
            [user_id, user.email, user.plan]
        )
        return {"id": user_id, "email": user.email, "plan": user.plan}
    except MoogoError as e:
        raise HTTPException(400, detail=e.message)

@app.get("/users/{user_id}", response_model=UserOut)
async def get_user(user_id: str):
    result = await to_objects(await sql("SELECT id, email, plan FROM users WHERE id = ?", [user_id]))
    if not result:
        raise HTTPException(404, "User not found")
    return result[0]

# ── Bucket endpoints ─────────────────────────────────────────────────
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    await bucket_upload(f"uploads/{file.filename}", content, file.content_type)
    return {"url": bucket_public_url(f"uploads/{file.filename}")}

@app.get("/files")
async def list_files():
    return (await bucket_list("uploads/")).get("objects", [])
```

## Run

```bash
uvicorn main:app --reload
# http://localhost:8000/docs — Swagger UI
```

## Dependency Injection (cleaner)

```python
# dependencies.py
# There is no MoogoClient class in this guide's client -- the module itself is
# the client -- so the dependency yields the module rather than an instance.
from fastapi import Depends
import moogo

async def get_moogo():
    yield moogo

# In routes:
@app.get("/users")
async def list_users(moogo=Depends(get_moogo)):
    return moogo.to_objects(await moogo.sql("SELECT id, email, plan FROM users"))
```

## Background tasks

```python
from fastapi import BackgroundTasks

@app.post("/users/bulk")
async def bulk_create(emails: list[str], background: BackgroundTasks):
    async def create_all():
        for email in emails:
            await sql("INSERT INTO users (id, email) VALUES (?, ?)", [str(uuid.uuid4()), email])
    background.add_task(create_all)
    return {"status": "processing", "count": len(emails)}
```

## Testing

```python
# test_main.py
import pytest
from httpx import AsyncClient
from main import app

@pytest.mark.asyncio
async def test_create_user():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        resp = await ac.post("/users", json={"email": "test@example.com"})
    assert resp.status_code == 201
    assert resp.json()["email"] == "test@example.com"
```

## Next

- [Flask guide](/docs/guides/flask)
- [Django guide](/docs/guides/django)
- [Python vanilla guide](/docs/guides/python-vanilla)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [SQL API reference](/docs/sql-api)