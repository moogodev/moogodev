# Django

Batteries-included, ORM-style patterns, async support.

## Setup

```bash
pip install django djangorestframework requests gunicorn
```

**Environment variables** (`.env` or `settings.py`):

```python
# settings.py
import os
MOOGO_PROJECT_URL = os.environ["MOOGO_PROJECT_URL"]
MOOGO_SECRET_KEY = os.environ["MOOGO_SECRET_KEY"]
MOOGO_BUCKET_ENDPOINT = os.environ["MOOGO_BUCKET_ENDPOINT"]
# Optional: origin public objects are served from; falls back to the bucket endpoint origin when empty.
MOOGO_CDN_URL = os.environ.get("MOOGO_CDN_URL", "")
MOOGO_BUCKET_ACCESS_KEY_ID = os.environ["MOOGO_BUCKET_ACCESS_KEY_ID"]
MOOGO_BUCKET_SECRET_KEY = os.environ["MOOGO_BUCKET_SECRET_KEY"]
```

## Client (`moogo/client.py`)

```python
# moogo/client.py
import requests
from typing import Any
from urllib.parse import quote

from django.conf import settings

class MoogoError(Exception):
    def __init__(self, error: dict):
        self.code = error.get("code")
        self.message = error.get("message")
        self.detail = error.get("detail")
        super().__init__(self.message)

class MoogoClient:
    def __init__(self):
        self.project_url = settings.MOOGO_PROJECT_URL
        self.secret_key = settings.MOOGO_SECRET_KEY
        self.bucket_endpoint = settings.MOOGO_BUCKET_ENDPOINT
        # Optional CDN origin for public objects; falls back to the bucket endpoint origin when empty.
        self.cdn_url = getattr(settings, "MOOGO_CDN_URL", "").rstrip("/")
        self.bucket_access_key_id = settings.MOOGO_BUCKET_ACCESS_KEY_ID
        self.bucket_secret_key = settings.MOOGO_BUCKET_SECRET_KEY

        self.sql_headers = {"Authorization": f"Bearer {self.secret_key}", "Content-Type": "application/json"}
        self.storage_headers = {"X-Moogo-Access-Key-Id": self.bucket_access_key_id, "Authorization": f"Bearer {self.bucket_secret_key}"}
        self.session = requests.Session()

    def _is_read(self, sql: str) -> bool:
        # `with` covers CTE reads (WITH ... SELECT); a CTE that writes
        # (WITH ... INSERT) must be sent to /exec directly.
        return sql.lstrip().upper().startswith(
            ("SELECT", "VALUES", "PRAGMA", "EXPLAIN", "WITH")
        )

    def _post(self, path: str, query: str, args: list[Any] = None) -> dict:
        args = args or []
        resp = self.session.post(f"{self.project_url}{path}", headers=self.sql_headers, json={"query": query, "args": args})
        body = resp.json()
        if resp.status_code >= 400:
            raise MoogoError(body.get("error", {}))
        return body

    def query(self, sql: str, args: list = None) -> dict:
        return self._post("/query", sql, args)

    def exec(self, sql: str, args: list = None) -> dict:
        return self._post("/exec", sql, args)

    def sql(self, sql: str, args: list = None) -> dict:
        return self.query(sql, args) if self._is_read(sql) else self.exec(sql, args)

    def to_objects(self, result: dict) -> list[dict]:
        cols = result.get("columns", [])
        return [dict(zip(cols, row)) for row in result.get("rows", [])]

    # ── Bucket ───────────────────────────────────────────────────────
    def bucket_upload(self, key: str, content: bytes, content_type: str) -> dict:
        resp = self.session.post(f"{self.bucket_endpoint}/{quote(key, safe='/')}", headers={**self.storage_headers, "Content-Type": content_type}, data=content)
        return resp.json()

    def bucket_download(self, key: str) -> bytes:
        resp = self.session.get(f"{self.bucket_endpoint}/{quote(key, safe='/')}", headers=self.storage_headers)
        return resp.content

    def bucket_delete(self, key: str) -> dict:
        resp = self.session.delete(f"{self.bucket_endpoint}/{quote(key, safe='/')}", headers=self.storage_headers)
        return resp.json()

    def bucket_list(self, prefix: str = None) -> dict:
        url = self.bucket_endpoint
        if prefix:
            url += f"?prefix={prefix}"
        resp = self.session.get(url, headers=self.storage_headers)
        return resp.json()

    def bucket_publish(self, key: str) -> dict:
        resp = self.session.patch(
            f"{self.bucket_endpoint}/{quote(key, safe='/')}",
            headers={**self.storage_headers, "Content-Type": "application/json"},
            json={"is_public": True},
        )
        return resp.json()

    def bucket_public_url(self, key: str) -> str:
        # /pub/<project-id>/<key> is the route that needs no credential. The
        # bucket endpoint is not it -- /p/<project-id>/bucket/<key> is the
        # authenticated URL, and an <img> pointed at one breaks for every private
        # object. This serves published objects only: a fresh upload is private,
        # so publish it with bucket_publish first. Until then, public_url in the
        # response is an empty string. Public objects are served from the CDN
        # origin (self.cdn_url) when set, otherwise from the bucket endpoint.
        origin, _, tail = self.bucket_endpoint.partition("/p/")
        project_id = tail.split("/")[0]
        return f"{self.cdn_url or origin}/pub/{project_id}/{quote(key, safe='/')}"
```

## Singleton instance (`moogo/__init__.py`)

```python
# moogo/__init__.py
from .client import MoogoClient

moogo_client = MoogoClient()
```

## Views (`views.py`)

```python
# users/views.py
from django.http import JsonResponse, HttpResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
import json
import uuid
from moogo import moogo_client, MoogoError

@method_decorator(csrf_exempt, name="dispatch")
class UserListView(View):
    def get(self, request):
        users = moogo_client.to_objects(moogo_client.sql("SELECT id, email, plan FROM users"))
        return JsonResponse(users, safe=False)

    def post(self, request):
        data = json.loads(request.body)
        user_id = str(uuid.uuid4())
        try:
            moogo_client.sql(
                "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
                [user_id, data["email"], data.get("plan", "free")]
            )
        except MoogoError as e:
            return JsonResponse({"error": e.message}, status=400)
        return JsonResponse({"id": user_id, "email": data["email"]}, status=201)

@method_decorator(csrf_exempt, name="dispatch")
class UserDetailView(View):
    def get(self, request, user_id):
        result = moogo_client.to_objects(moogo_client.sql("SELECT id, email, plan FROM users WHERE id = ?", [user_id]))
        if not result:
            return JsonResponse({"error": "Not found"}, status=404)
        return JsonResponse(result[0])
```

## Django REST Framework (DRF)

```python
# users/serializers.py
from rest_framework import serializers

class UserSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    email = serializers.EmailField()
    plan = serializers.CharField(default="free")
```

```python
# users/views.py (DRF)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from moogo import moogo_client, MoogoError
from .serializers import UserSerializer
import uuid

class UserViewSet(APIView):
    def get(self, request):
        users = moogo_client.to_objects(moogo_client.sql("SELECT id, email, plan FROM users"))
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_id = str(uuid.uuid4())
        try:
            moogo_client.sql(
                "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
                [user_id, serializer.validated_data["email"], serializer.validated_data.get("plan", "free")]
            )
        except MoogoError as e:
            return Response({"error": e.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"id": user_id, **serializer.validated_data}, status=status.HTTP_201_CREATED)
```

## Bucket Views

```python
# storage/views.py
from django.http import JsonResponse, FileResponse, HttpResponseBadRequest
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from moogo import moogo_client
import io

@method_decorator(csrf_exempt, name="dispatch")
class UploadView(View):
    def post(self, request):
        file = request.FILES["file"]
        moogo_client.bucket_upload(f"uploads/{file.name}", file.read(), file.content_type)
        moogo_client.bucket_publish(f"uploads/{file.name}")
        return JsonResponse({"url": moogo_client.bucket_public_url(f"uploads/{file.name}")})

class ListFilesView(View):
    def get(self, request):
        return JsonResponse(moogo_client.bucket_list("uploads/").get("objects", []), safe=False)

class DownloadView(View):
    def get(self, request, key):
        content = moogo_client.bucket_download(key)
        return FileResponse(io.BytesIO(content), as_attachment=True, filename=key.split("/")[-1])
```

## URLs

```python
# urls.py
from django.urls import path
from users.views import UserListView, UserDetailView
from storage.views import UploadView, ListFilesView, DownloadView

urlpatterns = [
    path("api/users/", UserListView.as_view()),
    path("api/users/<str:user_id>/", UserDetailView.as_view()),
    path("api/upload/", UploadView.as_view()),
    path("api/files/", ListFilesView.as_view()),
    path("api/download/<path:key>/", DownloadView.as_view()),
]
```

## Async views (Django 4.1+)

```python
# moogo/async_client.py
import aiohttp
from django.conf import settings

from .client import MoogoError

class AsyncMoogoClient:
    def __init__(self):
        self.project_url = settings.MOOGO_PROJECT_URL
        self.secret_key = settings.MOOGO_SECRET_KEY
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, *args):
        await self.session.close()

    async def sql(self, query: str, args: list = None):
        args = args or []
        # `with` covers CTE reads (WITH ... SELECT); a CTE that writes
        # (WITH ... INSERT) must be sent to /exec directly.
        endpoint = (
            "/query"
            if query.lstrip().upper().startswith(
                ("SELECT", "VALUES", "PRAGMA", "EXPLAIN", "WITH")
            )
            else "/exec"
        )
        async with self.session.post(f"{self.project_url}{endpoint}", headers={"Authorization": f"Bearer {self.secret_key}"}, json={"query": query, "args": args}) as resp:
            body = await resp.json()
            # aiohttp does not raise on a 4xx, so an unchecked response would
            # hand the caller an error body where it expects rows.
            if resp.status >= 400:
                raise MoogoError(body.get("error", {}))
            return body
```

```python
# views.py (async)
from django.http import JsonResponse
from moogo.async_client import AsyncMoogoClient

async def list_users(request):
    async with AsyncMoogoClient() as moogo:
        result = await moogo.sql("SELECT id, email, plan FROM users")
    # Rows come back as arrays aligned with columns, so the objects callers want
    # have to be built here.
    columns = result.get("columns", [])
    users = [dict(zip(columns, row)) for row in result.get("rows", [])]
    return JsonResponse(users, safe=False)
```

## Run

```bash
python manage.py runserver
# Production:
gunicorn myproject.wsgi:application -w 4 -b 0.0.0.0:8000
```

## Production Readiness ⚠️

- **SQL transactions**: Max 100 statements per `/transaction` and 15-second budget. Do not combine large DDL with intensive data manipulation in a single transaction.
- **Database size limit**: 250 MB per project. Database does not auto-shrink — delete rows progressively if approaching the limit, and monitor daily usage.
- **Sensitive column names**: Certain names (`readfile`, `writefile`, `delete`, `vacuum`, `attach`, `detach`, `reindex`, `analyze`, `pragma`) are blocked as column names in SQL queries.
- **Public object URLs**: `public_url` is a bearer token — cannot be revoked without rotating the key or unpublishing the object. Perform `PATCH is_public: true` after upload if you want to share without credentials.
- **Error handling**: Use `error.code` rather than `error.message` for safe branching (retryable vs non-retryable).

## Next

- [Flask guide](/docs/guides/flask)
- [FastAPI guide](/docs/guides/fastapi)
- [Python vanilla guide](/docs/guides/python-vanilla)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Object storage](/docs/object-storage)