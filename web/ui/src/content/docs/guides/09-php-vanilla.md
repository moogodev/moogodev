# PHP (Vanilla)

Works with PHP 8.1+, no framework required.

## Setup

```bash
# PHP 8.1+ with curl extension (enabled by default)
```

**Environment variables** (`.env` or server config):

```bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
```

## Client (`moogo.php`)

```php
<?php
// moogo.php

$projectUrl = $_ENV['MOOGO_PROJECT_URL'] ?? getenv('MOOGO_PROJECT_URL');
$secretKey = $_ENV['MOOGO_SECRET_KEY'] ?? getenv('MOOGO_SECRET_KEY');
$bucketEndpoint = $_ENV['MOOGO_BUCKET_ENDPOINT'] ?? getenv('MOOGO_BUCKET_ENDPOINT');
$bucketAccessKeyId = $_ENV['MOOGO_BUCKET_ACCESS_KEY_ID'] ?? getenv('MOOGO_BUCKET_ACCESS_KEY_ID');
$bucketSecretKey = $_ENV['MOOGO_BUCKET_SECRET_KEY'] ?? getenv('MOOGO_BUCKET_SECRET_KEY');

function moogoRequest(string $path, string $sql, array $args = []): array {
    global $projectUrl, $secretKey;
    $ch = curl_init("{$projectUrl}{$path}");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer {$secretKey}",
            "Content-Type: application/json",
        ],
        CURLOPT_POSTFIELDS => json_encode(["query" => $sql, "args" => $args]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $body = json_decode($response, true);
    if ($httpCode >= 400) {
        throw new MoogoException($body['error'] ?? []);
    }
    return $body;
}

function isRead(string $sql): bool {
    // WITH belongs here: a CTE that ends in a SELECT is a read, and /query takes
    // it. A CTE that writes still reaches /exec, which accepts writes anyway.
    return (bool) preg_match('/^\s*(SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\b/i', $sql);
}

function query(string $sql, array $args = []): array {
    return moogoRequest("/query", $sql, $args);
}

// Named execSql rather than exec: PHP has a built-in exec() for running a shell
// command, and a global-namespace file cannot redeclare it — the file would stop
// parsing with "Cannot redeclare function exec()".
function execSql(string $sql, array $args = []): array {
    return moogoRequest("/exec", $sql, $args);
}

function sql(string $sql, array $args = []): array {
    return isRead($sql) ? query($sql, $args) : execSql($sql, $args);
}

function toObjects(array $result): array {
    $cols = $result['columns'] ?? [];
    return array_map(fn($row) => array_combine($cols, $row), $result['rows'] ?? []);
}

// ── Bucket ───────────────────────────────────────────────────────────
function storageRequest(string $method, string $path, $body = null, array $extraHeaders = []): array|string {
    global $bucketEndpoint, $bucketAccessKeyId, $bucketSecretKey;
    $ch = curl_init("{$bucketEndpoint}{$path}");
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => array_merge([
            "X-Moogo-Access-Key-Id: {$bucketAccessKeyId}",
            "Authorization: Bearer {$bucketSecretKey}",
        ], $extraHeaders),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode >= 400) {
        throw new MoogoException(json_decode($response, true)['error'] ?? []);
    }
    if ($httpCode === 204) return [];
    return $response;
}

function bucketUpload(string $key, string $content, string $contentType): array {
    return json_decode(storageRequest("POST", "/{$key}", $content, ["Content-Type: {$contentType}"]), true);
}

function bucketDownload(string $key): string {
    return storageRequest("GET", "/{$key}");
}

function bucketDelete(string $key): array {
    return json_decode(storageRequest("DELETE", "/{$key}"), true);
}

function bucketList(?string $prefix = null): array {
    $path = $prefix ? "?prefix={$prefix}" : "";
    return json_decode(storageRequest("GET", $path), true);
}

function bucketPublicUrl(string $key): string {
    global $bucketEndpoint;
    // /pub/<project-id>/<key> is the route that needs no credential. The bucket
    // endpoint is not it -- /p/<project-id>/bucket/<key> is the authenticated
    // URL, and a browser tab carries no storage credential, so an <img> pointed at
    // one breaks for every private object. This serves published objects only.
    $publicBase = preg_replace('#/p/([^/]+)/bucket/?$#', '/pub/$1', $bucketEndpoint);
    return "{$publicBase}/{$key}";
}

// errorCode rather than code: Exception already has an int $code, and
// redeclaring it as a string makes the class a fatal error.
class MoogoException extends Exception {
    public string $errorCode;
    public ?string $detail;
    public function __construct(array $error) {
        $this->errorCode = $error['code'] ?? 'unknown';
        $this->detail = $error['detail'] ?? null;
        parent::__construct($error['message'] ?? 'Moogo request failed');
    }
}
```

## Usage — SQLite

```php
<?php
require 'moogo.php';

sql("
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    plan TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now'))
  )
");

sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
    [uniqid('u_', true), "ketut@example.com", "pro"]);

$users = toObjects(sql("SELECT id, email, plan FROM users WHERE plan = ?", ["pro"]));

foreach ($users as $user) {
    echo "{$user['email']} — {$user['plan']}\n";
}
```

## Usage — Bucket

```php
<?php
require 'moogo.php';

$content = file_get_contents("avatar.png");
bucketUpload("avatars/kit.png", $content, "image/png");

$files = bucketList("avatars/");
foreach ($files['objects'] as $obj) {
    echo "{$obj['key']} — {$obj['size_bytes']} bytes\n";
}

$download = bucketDownload("avatars/kit.png");
file_put_contents("kit-download.png", $download);

echo "Public URL: " . bucketPublicUrl("public/logo.png") . "\n";
```

## Error handling

```php
try {
    sql("SELECT * FROM nonexistent");
} catch (MoogoException $e) {
    if ($e->errorCode === 'sql_error') {
        echo "SQLite error: {$e->detail}\n";
    } elseif ($e->errorCode === 'database_too_large') {
        echo "Project hit 100 MB limit\n";
    } elseif ($e->getCode() === 401) {
        echo "Invalid or rotated secret key\n";
    }
    throw $e;
}
```

## PSR-7 / PSR-18 compatible (for frameworks)

```php
<?php
// moogo-psr.php
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestFactoryInterface;
use Psr\Http\Message\StreamFactoryInterface;

class MoogoClient {
    public function __construct(
        private ClientInterface $client,
        private RequestFactoryInterface $requestFactory,
        private StreamFactoryInterface $streamFactory,
        private string $projectUrl,
        private string $secretKey
    ) {}

    public function sql(string $sql, array $args = []): array {
        $endpoint = preg_match('/^\s*(SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\b/i', $sql) ? '/query' : '/exec';
        $request = $this->requestFactory->createRequest('POST', $this->projectUrl . $endpoint)
            ->withHeader('Authorization', "Bearer {$this->secretKey}")
            ->withHeader('Content-Type', 'application/json')
            ->withBody($this->streamFactory->createStream(json_encode(['query' => $sql, 'args' => $args])));
        $response = $this->client->sendRequest($request);
        $body = json_decode((string)$response->getBody(), true);
        if ($response->getStatusCode() >= 400) {
            throw new MoogoException($body['error'] ?? []);
        }
        return $body;
    }
}
```

## Next

- [Laravel guide](/docs/guides/laravel)
- [Vanilla JS guide](/docs/guides/javascript-vanilla)
- [SQL API reference](/docs/sql-api)
- [Schema & migrations](/docs/schema-best-practices) — transactions, batch inserts, paging, indexes
- [Object storage](/docs/object-storage)