# Laravel

Expressive, elegant, full-stack framework with built-in HTTP client.

## Setup

```bash
# Nothing to install: the Http client ships with Laravel itself.
```

**Environment variables** (`.env`):

```env
MOOGO_PROJECT_URL=https://api.moogo.dev/p/<project-id>
MOOGO_SECRET_KEY=moogo_...
MOOGO_BUCKET_ENDPOINT=https://api.moogo.dev/p/<project-id>/bucket
MOOGO_BUCKET_ACCESS_KEY_ID=moogo_ak_...
MOOGO_BUCKET_SECRET_KEY=moogo_sk_...
```

```php
// config/services.php
return [
    'moogo' => [
        'project_url' => env('MOOGO_PROJECT_URL'),
        'secret_key' => env('MOOGO_SECRET_KEY'),
        'bucket_endpoint' => env('MOOGO_BUCKET_ENDPOINT'),
        'bucket_access_key_id' => env('MOOGO_BUCKET_ACCESS_KEY_ID'),
        'bucket_secret_key' => env('MOOGO_BUCKET_SECRET_KEY'),
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
        private ?string $projectUrl = null,
        private ?string $secretKey = null,
        private ?string $bucketEndpoint = null,
        private ?string $bucketAccessKeyId = null,
        private ?string $bucketSecretKey = null
    ) {
        $this->projectUrl ??= config('services.moogo.project_url');
        $this->secretKey ??= config('services.moogo.secret_key');
        $this->bucketEndpoint ??= config('services.moogo.bucket_endpoint');
        $this->bucketAccessKeyId ??= config('services.moogo.bucket_access_key_id');
        $this->bucketSecretKey ??= config('services.moogo.bucket_secret_key');
    }

    private function sqlClient(): \Illuminate\Http\Client\PendingRequest {
        return Http::withHeaders([
            'Authorization' => "Bearer {$this->secretKey}",
            'Content-Type' => 'application/json',
        ])->baseUrl($this->projectUrl)->timeout(30);
    }

    private function storageClient(): \Illuminate\Http\Client\PendingRequest {
        return Http::withHeaders([
            'X-Moogo-Access-Key-Id' => $this->bucketAccessKeyId,
            'Authorization' => "Bearer {$this->bucketSecretKey}",
        ])->baseUrl($this->bucketEndpoint)->timeout(30);
    }

    private function isRead(string $sql): bool {
        // WITH belongs here: a CTE that ends in a SELECT is a read, and /query
        // takes it. A CTE that writes still reaches /exec, which accepts writes.
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
        $response = $this->storageClient()
            ->withHeaders(['Content-Type' => $contentType])
            ->post("/{$key}", $content);
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

    public function bucketPublicUrl(string $key): string {
        // /pub/<project-id>/<key> is the route that needs no credential. The
        // bucket endpoint is not it -- /p/<project-id>/bucket/<key> is the
        // authenticated URL, and an <img> pointed at one breaks for every private
        // object. This serves published objects only.
        $base = preg_replace('#/p/([^/]+)/bucket/?$#', '/pub/$1', $this->bucketEndpoint);
        return "{$base}/{$key}";
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
        config('services.moogo.project_url') . '/*' => Http::response([
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

## Next

- [PHP vanilla guide](/docs/guides/php-vanilla)
- [FastAPI guide](/docs/guides/fastapi)
- [Django guide](/docs/guides/django)
- [Object storage](/docs/object-storage)