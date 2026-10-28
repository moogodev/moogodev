# Laravel

Expressive, elegant, full-stack framework with built-in HTTP client.

## Setup

```bash
# Nothing to install: the Http client ships with Laravel itself.
```

**Environment variables** (`.env`):

```env
MOOGO_BASE_URL=https://api.moogo.dev
MOOGO_PROJECT_ID=8f3c1a20-5b7e-4a91-9d3c-2f6b81e4a7d0
MOOGO_SQL_KEY=moogo_...
# Optional: origin public objects are served from (e.g. https://cdn.moogo.dev); empty falls back to the API origin.
MOOGO_CDN_URL=
MOOGO_STORAGE_ACCESS_KEY_ID=moogo_ak_...
MOOGO_STORAGE_SECRET_KEY=moogo_sk_...
```

```php
// config/services.php
return [
    'moogo' => [
        'base_url' => env('MOOGO_BASE_URL'),
        'project_id' => env('MOOGO_PROJECT_ID'),
        'secret_key' => env('MOOGO_SQL_KEY'),
        'cdn_url' => env('MOOGO_CDN_URL'),
        'bucket_access_key_id' => env('MOOGO_STORAGE_ACCESS_KEY_ID'),
        'bucket_secret_key' => env('MOOGO_STORAGE_SECRET_KEY'),
    ],
];
```

## Service (`app/Services/Moogo.php`)

```php
<?php
// app/Services/Moogo.php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Response;

class Moogo {
    // The promoted properties are nullable because the constructor defaults them
    // to null before reading config. A non-nullable `string $x = null` is a
    // fatal error, not a default.
    public function __construct(
        private ?string $baseUrl = null,
        private ?string $projectId = null,
        private ?string $secretKey = null,
        private ?string $cdnUrl = null,
        private ?string $bucketAccessKeyId = null,
        private ?string $bucketSecretKey = null
    ) {
        $this->baseUrl ??= config('services.moogo.base_url');
        $this->baseUrl = rtrim((string) $this->baseUrl, '/');
        $this->projectId ??= config('services.moogo.project_id');
        $this->secretKey ??= config('services.moogo.secret_key');
        $this->cdnUrl ??= config('services.moogo.cdn_url');
        $this->cdnUrl = rtrim((string) $this->cdnUrl, '/');
        $this->bucketAccessKeyId ??= config('services.moogo.bucket_access_key_id');
        $this->bucketSecretKey ??= config('services.moogo.bucket_secret_key');
    }

    private function bucketEndpoint(): string {
        return "{$this->baseUrl}/p/{$this->projectId}/bucket";
    }

    private function sqlClient(): \Illuminate\Http\Client\PendingRequest {
        return Http::withHeaders([
            'Authorization' => "Bearer {$this->secretKey}",
            'Content-Type' => 'application/json',
        ])->baseUrl("{$this->baseUrl}/p/{$this->projectId}")->timeout(30);
    }

    private function storageClient(): \Illuminate\Http\Client\PendingRequest {
        return Http::withHeaders([
            'X-Moogo-Access-Key-Id' => $this->bucketAccessKeyId,
            'Authorization' => "Bearer {$this->bucketSecretKey}",
        ])->baseUrl($this->bucketEndpoint())->timeout(30);
    }

    private function isRead(string $sql): bool {
        // `with` covers CTE reads (WITH ... SELECT); a CTE that writes
        // (WITH ... INSERT) must be sent to /exec directly.
        return (bool) preg_match('/^\s*(SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\b/i', $sql);
    }

    private function handleError(Response $response): void {
        if ($response->failed()) {
            $error = $response->json('error', []);
            throw new MoogoException($error);
        }
    }

    // ── SQL ────────────────────────────────────────────────────────────
    public function query(string $sql, array $args = []): array {
        $response = $this->sqlClient()->post('/query', ['query' => $sql, 'args' => $args]);
        $this->handleError($response);
        return $response->json();
    }

    public function exec(string $sql, array $args = []): array {
        $response = $this->sqlClient()->post('/exec', ['query' => $sql, 'args' => $args]);
        $this->handleError($response);
        return $response->json();
    }

    public function sql(string $sql, array $args = []): array {
        return $this->isRead($sql) ? $this->query($sql, $args) : $this->exec($sql, $args);
    }

    public function toObjects(array $result): array {
        $cols = $result['columns'] ?? [];
        return array_map(fn($row) => array_combine($cols, $row), $result['rows'] ?? []);
    }

    // ── Bucket ─────────────────────────────────────────────────────────
    public function bucketUpload(string $key, string $content, string $contentType): array {
        $path = implode('/', array_map('rawurlencode', explode('/', $key)));
        $response = $this->storageClient()
            ->withHeaders(['Content-Type' => $contentType])
            ->post("/{$path}", $content);
        $this->handleError($response);
        return $response->json();
    }

    public function bucketDownload(string $key): string {
        $response = $this->storageClient()->get("/{$key}");
        $this->handleError($response);
        return $response->body();
    }

    public function bucketDelete(string $key): array {
        $response = $this->storageClient()->delete("/{$key}");
        $this->handleError($response);
        return $response->json();
    }

    public function bucketList(?string $prefix = null): array {
        $url = $prefix ? "?prefix={$prefix}" : "";
        $response = $this->storageClient()->get($url);
        $this->handleError($response);
        return $response->json();
    }

    public function bucketPublish(string $key): array {
        $path = implode('/', array_map('rawurlencode', explode('/', $key)));
        $response = $this->storageClient()
            ->withHeaders(['Content-Type' => 'application/json'])
            ->patch("/{$path}", ['is_public' => true]);
        $this->handleError($response);
        return $response->json();
    }

    public function bucketPublicUrl(string $key): string {
        // /pub/<project-id>/<key> is the route that needs no credential. The
        // bucket endpoint is not it -- /p/<project-id>/bucket/<key> is the
        // authenticated URL, and an <img> pointed at one breaks for every private
        // object. This serves published objects only: a fresh upload is private,
        // so publish it with bucketPublish first. Until then, public_url in the
        // response is an empty string. When MOOGO_CDN_URL is set, public objects
        // are served from that CDN host instead of the API origin.
        $base = "{$this->baseUrl}/pub/{$this->projectId}";
        if ($this->cdnUrl !== '') {
            // Keep the /pub/<project-id> path, swap only the scheme and host.
            $base = preg_replace('#^https?://[^/]+#', $this->cdnUrl, $base);
        }
        $path = implode('/', array_map('rawurlencode', explode('/', $key)));
        return "{$base}/{$path}";
    }
}

// errorCode rather than code: Exception already has an int $code, and
// redeclaring it as a string makes the class a fatal error.
class MoogoException extends \Exception {
    public string $errorCode;
    public ?string $detail;
    public function __construct(array $error) {
        $this->errorCode = $error['code'] ?? 'unknown';
        $this->detail = $error['detail'] ?? null;
        parent::__construct($error['message'] ?? 'Moogo request failed');
    }
}
```

## Register as singleton (`app/Providers/AppServiceProvider.php`)

```php
// app/Providers/AppServiceProvider.php
public function register(): void {
    $this->app->singleton(\App\Services\Moogo::class, fn() => new \App\Services\Moogo());
}
```

## Controller (`app/Http/Controllers/UserController.php`)

```php
<?php
// app/Http/Controllers/UserController.php

namespace App\Http\Controllers;

use App\Services\Moogo;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class UserController extends Controller {
    public function __construct(private Moogo $moogo) {}

    public function index(): JsonResponse {
        return response()->json($this->moogo->toObjects(
            $this->moogo->sql("SELECT id, email, plan FROM users")
        ));
    }

    public function store(Request $request): JsonResponse {
        $request->validate(['email' => 'required|email', 'plan' => 'string']);
        try {
            $id = (string) \Illuminate\Support\Str::uuid();
            $this->moogo->sql(
                "INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
                [$id, $request->email, $request->plan ?? 'free']
            );
        } catch (\App\Services\MoogoException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
        return response()->json(['id' => $id, 'email' => $request->email], 201);
    }

    public function show(string $id): JsonResponse {
        $user = $this->moogo->toObjects(
            $this->moogo->sql("SELECT id, email, plan FROM users WHERE id = ?", [$id])
        );
        if (!$user) return response()->json(['error' => 'Not found'], 404);
        return response()->json($user[0]);
    }
}
```

## Bucket Controller (`app/Http/Controllers/StorageController.php`)

```php
<?php
// app/Http/Controllers/StorageController.php

namespace App\Http\Controllers;

use App\Services\Moogo;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class StorageController extends Controller {
    public function __construct(private Moogo $moogo) {}

    public function upload(Request $request): JsonResponse {
        $request->validate(['file' => 'required|file|max:10240']);
        $file = $request->file('file');
        $path = "uploads/{$file->hashName()}";
        $this->moogo->bucketUpload($path, file_get_contents($file), $file->getMimeType());
        $this->moogo->bucketPublish($path);
        return response()->json(['url' => $this->moogo->bucketPublicUrl($path)]);
    }

    public function list(): JsonResponse {
        return response()->json($this->moogo->bucketList('uploads/')['objects'] ?? []);
    }

    public function download(string $key) {
        $content = $this->moogo->bucketDownload($key);
        return response($content)
            ->header('Content-Disposition', "attachment; filename=\"{$key}\"");
    }
}
```

## Routes (`routes/api.php`)

```php
use App\Http\Controllers\UserController;
use App\Http\Controllers\StorageController;

Route::apiResource('users', UserController::class)->only(['index', 'store', 'show']);
Route::post('storage/upload', [StorageController::class, 'upload']);
Route::get('storage/files', [StorageController::class, 'list']);
Route::get('storage/download/{key}', [StorageController::class, 'download'])->where('key', '.*');
```

## Blade Components (for public objects)

```blade
{{-- resources/views/components/moogo-avatar.blade.php --}}
@props(['key'])
<img src="{{ app(\App\Services\Moogo::class)->bucketPublicUrl($key) }}" alt="" />
```

```blade
{{-- usage --}}
<x-moogo-avatar key="public/avatars/user.png" />
```

## Queue Jobs (background processing)

```php
<?php
// app/Jobs/ProcessUsers.php

namespace App\Jobs;

use App\Services\Moogo;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;

class ProcessUsers implements ShouldQueue {
    use Dispatchable, Queueable;

    public function __construct(public array $emails) {}

    public function handle(Moogo $moogo): void {
        foreach ($this->emails as $email) {
            $moogo->sql("INSERT INTO users (id, email) VALUES (?, ?)", [
                (string) \Illuminate\Support\Str::uuid(), $email
            ]);
        }
    }
}
```

```php
// Controller
ProcessUsers::dispatch($emails)->onQueue('moogo');
```

## Testing

```php
// tests/Feature/UserTest.php
public function test_create_user() {
    Http::fake([
        config('services.moogo.base_url') . '/p/' . config('services.moogo.project_id') . '/*' => Http::response([
            'success' => true,
            'rows_affected' => 1,
        ], 200),
    ]);

    $response = $this->postJson('/api/users', ['email' => 'test@example.com']);
    $response->assertStatus(201)->assertJsonStructure(['id', 'email']);
}
```

## Octane / Swoole (high performance)

```bash
composer require laravel/octane
php artisan octane:install --server=swoole
php artisan octane:start
```

The `Http` facade works natively with Octane/Swoole.

## Production Readiness ⚠️

- **SQL transactions**: Max 100 statements per `/transaction` and 15-second budget. Do not combine large DDL with intensive data manipulation in a single transaction.
- **Database size limit**: 256 MB per project. Database does not auto-shrink — delete rows progressively if approaching the limit, and monitor daily usage.
- **Sensitive column names**: Certain names (`readfile`, `writefile`, `delete`, `vacuum`, `attach`, `detach`, `reindex`, `analyze`, `pragma`) are blocked as column names in SQL queries.
- **Public object URLs**: `public_url` is a bearer token — cannot be revoked without rotating the key or unpublishing the object. Perform bucket-level visibility toggle (Dashboard → Bucket settings → Public) after upload if you want to share without credentials.
- **Error handling**: Use `error.code` rather than `error.message` for safe branching (retryable vs non-retryable).

## Next

- [PHP vanilla guide](/docs/guides/php-vanilla)
- [FastAPI guide](/docs/guides/fastapi)
- [Django guide](/docs/guides/django)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Object storage](/docs/object-storage)