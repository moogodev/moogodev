var e=`# Flask

Lightweight, synchronous, great for small services.

## Setup

\`\`\`bash
pip install flask requests gunicorn
\`\`\`

**Environment variables:**

\`\`\`bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
\`\`\`

## Client (\`moogo.py\`)

\`\`\`python
# moogo.py
import os
import requests
from typing import Any
from urllib.parse import quote

PROJECT_URL = os.environ["MOOGO_PROJECT_URL"]
SECRET_KEY = os.environ["MOOGO_SECRET_KEY"]
BUCKET_ENDPOINT = os.environ["MOOGO_BUCKET_ENDPOINT"]
BUCKET_ACCESS_KEY_ID = os.environ["MOOGO_BUCKET_ACCESS_KEY_ID"]
BUCKET_SECRET_KEY = os.environ["MOOGO_BUCKET_SECRET_KEY"]

SQL_HEADERS = {"Authorization": f"Bearer {SECRET_KEY}", "Content-Type": "application/json"}
STORAGE_HEADERS = {"X-Moogo-Access-Key-Id": BUCKET_ACCESS_KEY_ID, "Authorization": f"Bearer {BUCKET_SECRET_KEY}"}

session = requests.Session()

def is_read(sql: str) -> bool:
    # WITH belongs here: a CTE that ends in a SELECT is a read, and /query takes
    # it. A CTE that writes still reaches /exec, which accepts writes anyway.
    return sql.lstrip().upper().startswith(
        ("SELECT", "VALUES", "PRAGMA", "EXPLAIN", "WITH")
    )

def _post(path: str, query: str, args: list[Any] = None) -> dict:
    args = args or []
    resp = session.post(f"{PROJECT_URL}{path}", headers=SQL_HEADERS, json={"query": query, "args": args})
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
def bucket_upload(key: str, content: bytes, content_type: str) -> dict:
    resp = session.post(f"{BUCKET_ENDPOINT}/{quote(key, safe='/')}", headers={**STORAGE_HEADERS, "Content-Type": content_type}, data=content)
    return resp.json()

def bucket_download(key: str) -> bytes:
    resp = session.get(f"{BUCKET_ENDPOINT}/{quote(key, safe='/')}", headers=STORAGE_HEADERS)
    return resp.content

def bucket_delete(key: str) -> dict:
    resp = session.delete(f"{BUCKET_ENDPOINT}/{quote(key, safe='/')}", headers=STORAGE_HEADERS)
    return resp.json()

def bucket_list(prefix: str = None) -> dict:
    url = BUCKET_ENDPOINT
    if prefix:
        url += f"?prefix={prefix}"
    resp = session.get(url, headers=STORAGE_HEADERS)
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
\`\`\`

## Flask App (\`app.py\`)

\`\`\`python
# app.py
from flask import Flask, request, jsonify, send_file
from moogo import sql, to_objects, bucket_upload, bucket_download, bucket_public_url, MoogoError
import uuid
import io

app = Flask(__name__)

@app.route("/users")
def list_users():
    return jsonify(to_objects(sql("SELECT id, email, plan FROM users")))

@app.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()
    user_id = str(uuid.uuid4())
    try:
        sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [user_id, data["email"], data.get("plan", "free")])
    except MoogoError as e:
        return jsonify({"error": e.message}), 400
    return jsonify({"id": user_id, "email": data["email"]}), 201

@app.route("/users/<user_id>")
def get_user(user_id):
    result = to_objects(sql("SELECT id, email, plan FROM users WHERE id = ?", [user_id]))
    if not result:
        return jsonify({"error": "Not found"}), 404
    return jsonify(result[0])

# ── Bucket ───────────────────────────────────────────────────────────
@app.route("/upload", methods=["POST"])
def upload_file():
    file = request.files["file"]
    bucket_upload(f"uploads/{file.filename}", file.read(), file.content_type)
    return jsonify({"url": bucket_public_url(f"uploads/{file.filename}")})

@app.route("/files")
def list_files():
    return jsonify(bucket_list("uploads/").get("objects", []))

@app.route("/download/<path:key>")
def download_file(key):
    content = bucket_download(key)
    return send_file(io.BytesIO(content), as_attachment=True, download_name=key.split("/")[-1])
\`\`\`

## Run

\`\`\`bash
flask --app app run --debug
# or production:
gunicorn -w 4 -b 0.0.0.0:8000 app:app
\`\`\`

## Blueprints (modular)

\`\`\`python
# moogo_bp.py
from flask import Blueprint, request, jsonify
from moogo import sql, to_objects, MoogoError
import uuid

bp = Blueprint("moogo", __name__)

@bp.route("/users")
def list_users():
    return jsonify(to_objects(sql("SELECT id, email, plan FROM users")))

@bp.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()
    user_id = str(uuid.uuid4())
    try:
        sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)", [user_id, data["email"], data.get("plan", "free")])
    except MoogoError as e:
        return jsonify({"error": e.message}), 400
    return jsonify({"id": user_id, "email": data["email"]}), 201
\`\`\`

\`\`\`python
# app.py
from flask import Flask
from moogo_bp import bp

app = Flask(__name__)
app.register_blueprint(bp, url_prefix="/api")
\`\`\`

## Error handling

\`\`\`python
@app.errorhandler(MoogoError)
def handle_moogo_error(e):
    if e.code == "database_too_large":
        return jsonify({"error": "Project quota exceeded"}), 413
    if e.code == "sql_forbidden_keyword":
        return jsonify({"error": "Invalid SQL"}), 400
    return jsonify({"error": e.message}), 500
\`\`\`

## Next

- [Django guide](/docs/guides/django)
- [FastAPI guide](/docs/guides/fastapi)
- [Python vanilla guide](/docs/guides/python-vanilla)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Object storage](/docs/object-storage)`;export{e as default};