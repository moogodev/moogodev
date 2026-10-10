# Java / Kotlin

Works with Java 17+ (HttpClient), Spring Boot, Quarkus, Micronaut, or Kotlin coroutines.

## Setup

```xml
<!-- Maven -->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>2.17.0</version>
</dependency>
<!-- Or Gradle: implementation("com.fasterxml.jackson.core:jackson-databind:2.17.0") -->
```

**Environment variables:**

```bash
export MOOGO_PROJECT_URL="https://api.moogo.dev/p/<project-id>"
export MOOGO_SECRET_KEY="moogo_..."
export MOOGO_BUCKET_ENDPOINT="https://api.moogo.dev/p/<project-id>/bucket"
export MOOGO_BUCKET_ACCESS_KEY_ID="moogo_ak_..."
export MOOGO_BUCKET_SECRET_KEY="moogo_sk_..."
```

## Java Client (Vanilla)

```java
// Moogo.java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public class Moogo {
    private static final String PROJECT_URL = System.getenv("MOOGO_PROJECT_URL");
    private static final String SECRET_KEY = System.getenv("MOOGO_SECRET_KEY");
    private static final String BUCKET_ENDPOINT = System.getenv("MOOGO_BUCKET_ENDPOINT");
    private static final String BUCKET_ACCESS_KEY_ID = System.getenv("MOOGO_BUCKET_ACCESS_KEY_ID");
    private static final String BUCKET_SECRET_KEY = System.getenv("MOOGO_BUCKET_SECRET_KEY");

    private static final HttpClient HTTP = HttpClient.newHttpClient();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static CompletableFuture<Map<String, Object>> query(String sql, List<Object> args) {
        return request("/query", sql, args);
    }

    public static CompletableFuture<Map<String, Object>> exec(String sql, List<Object> args) {
        return request("/exec", sql, args);
    }

    public static CompletableFuture<Map<String, Object>> sql(String sql, List<Object> args) {
        if (sql.trim().matches("(?i)^(SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\\b.*")) {
            return query(sql, args);
        }
        return exec(sql, args);
    }

    private static CompletableFuture<Map<String, Object>> request(String path, String sql, List<Object> args) {
        var body = Map.of("query", sql, "args", args);
        var json = MAPPER.writeValueAsString(body);

        var request = HttpRequest.newBuilder()
            .uri(URI.create(PROJECT_URL + path))
            .header("Authorization", "Bearer " + SECRET_KEY)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build();

        return HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString())
            .thenApply(res -> {
                if (res.statusCode() >= 400) {
                    throw new MoogoException(res.body(), res.statusCode());
                }
                return MAPPER.readValue(res.body(), Map.class);
            });
    }

    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> toObjects(Map<String, Object> result) {
        List<String> cols = (List<String>) result.get("columns");
        List<List<Object>> rows = (List<List<Object>>) result.get("rows");
        return rows.stream().map(row -> {
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            for (int i = 0; i < cols.size(); i++) map.put(cols.get(i), row.get(i));
            return map;
        }).toList();
    }

    // ── Bucket ─────────────────────────────────────────────────────────
    public static CompletableFuture<Map<String, Object>> bucketUpload(String key, byte[] content, String contentType) {
        var request = HttpRequest.newBuilder()
            .uri(URI.create(BUCKET_ENDPOINT + "/" + key))
            .header("X-Moogo-Access-Key-Id", BUCKET_ACCESS_KEY_ID)
            .header("Authorization", "Bearer " + BUCKET_SECRET_KEY)
            .header("Content-Type", contentType)
            .POST(HttpRequest.BodyPublishers.ofByteArray(content))
            .build();
        return HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString())
            .thenApply(res -> {
                if (res.statusCode() >= 400) throw new MoogoException(res.body(), res.statusCode());
                return MAPPER.readValue(res.body(), Map.class);
            });
    }

    public static CompletableFuture<byte[]> bucketDownload(String key) {
        var request = HttpRequest.newBuilder()
            .uri(URI.create(BUCKET_ENDPOINT + "/" + key))
            .header("X-Moogo-Access-Key-Id", BUCKET_ACCESS_KEY_ID)
            .header("Authorization", "Bearer " + BUCKET_SECRET_KEY)
            .GET()
            .build();
        return HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofByteArray())
            .thenApply(HttpResponse::body);
    }

    public static CompletableFuture<Map<String, Object>> bucketDelete(String key) {
        var request = HttpRequest.newBuilder()
            .uri(URI.create(BUCKET_ENDPOINT + "/" + key))
            .header("X-Moogo-Access-Key-Id", BUCKET_ACCESS_KEY_ID)
            .header("Authorization", "Bearer " + BUCKET_SECRET_KEY)
            .DELETE()
            .build();
        return HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString())
            .thenApply(res -> {
                if (res.statusCode() >= 400) throw new MoogoException(res.body(), res.statusCode());
                return MAPPER.readValue(res.body(), Map.class);
            });
    }

    public static String bucketPublicUrl(String key) {
        // /pub/<id>/<key> is the route that needs no credential. The bucket
        // endpoint is not it -- /p/<id>/bucket/<key> is the authenticated URL,
        // and an <img> pointed at one breaks for every private object. This
        // serves published objects only.
        String base = BUCKET_ENDPOINT.replaceAll("/p/([^/]+)/bucket/?$", "/pub/$1");
        return base + "/" + key;
    }
}

// The body is the documented envelope -- {"error":{"code":…}} -- and parsing it
// here is what lets a catch block branch on e.code instead of on a message string.
class MoogoException extends RuntimeException {
    public final String code;
    public final String detail;
    public final int status;

    MoogoException(String json, int status) {
        super(extract(json, "message", "Moogo request failed"));
        this.status = status;
        this.code = extract(json, "code", "unknown");
        this.detail = extract(json, "detail", null);
    }

    // A body that is not the envelope still has to raise this exception rather
    // than a parser error from inside the constructor.
    private static String extract(String json, String field, String fallback) {
        try {
            JsonNode value = new ObjectMapper().readTree(json).path("error").path(field);
            return value.isMissingNode() || value.isNull() ? fallback : value.asText();
        } catch (Exception e) {
            return fallback;
        }
    }
}
```

## Usage (Java)

```java
import java.util.*;
import java.util.concurrent.CompletableFuture;

public class Main {
    public static void main(String[] args) throws Exception {
        // Create table
        Moogo.sql("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                plan TEXT DEFAULT 'free'
            )
            """, List.of()).join();

        // Insert
        Moogo.sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
            List.of(UUID.randomUUID().toString(), "ketut@example.com", "pro")).join();

        // Query
        var users = Moogo.toObjects(Moogo.sql("SELECT id, email, plan FROM users WHERE plan = ?", List.of("pro")).join());
        System.out.println(users);

        // Bucket
        byte[] content = Files.readAllBytes(Path.of("avatar.png"));
        Moogo.bucketUpload("avatars/kit.png", content, "image/png").join();
        System.out.println(Moogo.bucketPublicUrl("public/logo.png"));
    }
}
```

---

## Spring Boot

### Configuration (`application.yml`)

```yaml
moogo:
  project-url: ${MOOGO_PROJECT_URL}
  secret-key: ${MOOGO_SECRET_KEY}
  bucket-endpoint: ${MOOGO_BUCKET_ENDPOINT}
  bucket-access-key-id: ${MOOGO_BUCKET_ACCESS_KEY_ID}
  bucket-secret-key: ${MOOGO_BUCKET_SECRET_KEY}
```

### Client Bean (`MoogoClient.java`)

```java
@Component
public class MoogoClient {
    private final String projectUrl, secretKey, bucketEndpoint, bucketAccessKeyId, bucketSecretKey;
    private final WebClient webClient;

    public MoogoClient(@Value("${moogo.project-url}") String projectUrl,
                       @Value("${moogo.secret-key}") String secretKey,
                       @Value("${moogo.bucket-endpoint}") String bucketEndpoint,
                       @Value("${moogo.bucket-access-key-id}") String bucketAccessKeyId,
                       @Value("${moogo.bucket-secret-key}") String bucketSecretKey,
                       WebClient.Builder builder) {
        this.projectUrl = projectUrl;
        this.secretKey = secretKey;
        this.bucketEndpoint = bucketEndpoint;
        this.bucketAccessKeyId = bucketAccessKeyId;
        this.bucketSecretKey = bucketSecretKey;
        this.webClient = builder.build();
    }

    public Mono<Map<String, Object>> sql(String sql, List<Object> args) {
        String path = sql.trim().matches("(?i)^(SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\\b.*") ? "/query" : "/exec";
        return webClient.post()
            .uri(projectUrl + path)
            .header("Authorization", "Bearer " + secretKey)
            .bodyValue(Map.of("query", sql, "args", args))
            .retrieve()
            .onStatus(s -> s.is4xxClientError() || s.is5xxServerError(),
                res -> res.bodyToMono(String.class).map(MoogoException::new))
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    public Flux<Map<String, Object>> toObjects(Mono<Map<String, Object>> result) {
        return result.flatMapIterable(r -> {
            List<String> cols = (List<String>) r.get("columns");
            List<List<Object>> rows = (List<List<Object>>) r.get("rows");
            return rows.stream().map(row -> {
                Map<String, Object> map = new LinkedHashMap<>();
                for (int i = 0; i < cols.size(); i++) map.put(cols.get(i), row.get(i));
                return map;
            }).toList();
        });
    }

    // Bucket methods similar...
}
```

### Controller

```java
@RestController
@RequestMapping("/api/users")
public class UserController {
    private final MoogoClient moogo;

    public UserController(MoogoClient moogo) { this.moogo = moogo; }

    @GetMapping
    public Flux<Map<String, Object>> list() {
        return moogo.toObjects(moogo.sql("SELECT id, email, plan FROM users", List.of()));
    }

    @PostMapping
    public Mono<Map<String, Object>> create(@RequestBody UserRequest req) {
        String id = UUID.randomUUID().toString();
        return moogo.sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
            List.of(id, req.email(), req.plan()))
            .map(r -> Map.of("id", id, "email", req.email(), "plan", req.plan()));
    }
}
```

---

## Kotlin Coroutines

```kotlin
// Moogo.kt
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper

object Moogo {
    private val PROJECT_URL = System.getenv("MOOGO_PROJECT_URL")!!
    private val SECRET_KEY = System.getenv("MOOGO_SECRET_KEY")!!
    private val BUCKET_ENDPOINT = System.getenv("MOOGO_BUCKET_ENDPOINT")!!
    private val BUCKET_ACCESS_KEY_ID = System.getenv("MOOGO_BUCKET_ACCESS_KEY_ID")!!
    private val BUCKET_SECRET_KEY = System.getenv("MOOGO_BUCKET_SECRET_KEY")!!

    private val HTTP = HttpClient.newHttpClient()
    private val MAPPER = jacksonObjectMapper()

    private fun isRead(sql: String) = sql.trim().matches(Regex("(?i)^(SELECT|VALUES|PRAGMA|EXPLAIN|WITH)\\b.*"))

    suspend fun sql(sql: String, args: List<Any> = emptyList()): Map<String, Any> {
        val path = if (isRead(sql)) "/query" else "/exec"
        val body = mapOf("query" to sql, "args" to args)
        val json = MAPPER.writeValueAsString(body)

        val request = HttpRequest.newBuilder()
            .uri(URI.create(PROJECT_URL + path))
            .header("Authorization", "Bearer $SECRET_KEY")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json))
            .build()

        val response = HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString()).await()
        if (response.statusCode() >= 400) throw MoogoException(response.body(), response.statusCode())
        return MAPPER.readValue(response.body())
    }

    fun toObjects(result: Map<String, Any>): List<Map<String, Any>> {
        val cols = result["columns"] as List<String>
        val rows = result["rows"] as List<List<Any>>
        return rows.map { row -> cols.zip(row).toMap() }
    }

    // Bucket
    suspend fun bucketUpload(key: String, content: ByteArray, contentType: String): Map<String, Any> {
        val request = HttpRequest.newBuilder()
            .uri(URI.create("$BUCKET_ENDPOINT/$key"))
            .header("X-Moogo-Access-Key-Id", BUCKET_ACCESS_KEY_ID)
            .header("Authorization", "Bearer $BUCKET_SECRET_KEY")
            .header("Content-Type", contentType)
            .POST(HttpRequest.BodyPublishers.ofByteArray(content))
            .build()
        val response = HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString()).await()
        if (response.statusCode() >= 400) throw MoogoException(response.body(), response.statusCode())
        return MAPPER.readValue(response.body())
    }

    suspend fun bucketDownload(key: String): ByteArray {
        val request = HttpRequest.newBuilder()
            .uri(URI.create("$BUCKET_ENDPOINT/$key"))
            .header("X-Moogo-Access-Key-Id", BUCKET_ACCESS_KEY_ID)
            .header("Authorization", "Bearer $BUCKET_SECRET_KEY")
            .GET()
            .build()
        val response = HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofByteArray()).await()
        return response.body()
    }

    // /pub/<id>/<key> is the route that needs no credential; the bucket endpoint
    // is the authenticated one, which an <img> tag cannot carry. Published only.
    fun bucketPublicUrl(key: String) =
        BUCKET_ENDPOINT.replace(Regex("/p/([^/]+)/bucket/?$"), "/pub/\$1") + "/" + key
}

class MoogoException(val body: String, val status: Int) : RuntimeException(body) {
    val code: String = runCatching {
        jacksonObjectMapper().readTree(body).path("error").path("code").asText("unknown")
    }.getOrDefault("unknown")
}
```

### Usage (Kotlin)

```kotlin
import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    Moogo.sql("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            plan TEXT DEFAULT 'free'
        )
    """)

    Moogo.sql("INSERT INTO users (id, email, plan) VALUES (?, ?, ?)",
        listOf(UUID.randomUUID().toString(), "ketut@example.com", "pro"))

    val users = Moogo.toObjects(Moogo.sql("SELECT id, email, plan FROM users WHERE plan = ?", listOf("pro")))
    println(users)

    val content = File("avatar.png").readBytes()
    Moogo.bucketUpload("avatars/kit.png", content, "image/png")
    println(Moogo.bucketPublicUrl("public/logo.png"))
}
```

## Quarkus / Micronaut

```java
// Quarkus - use REST Client
@RegisterRestClient(configKey = "moogo")
public interface MoogoClient {
    @POST @Path("/query")
    CompletionStage<JsonNode> query(JsonNode body);

    @POST @Path("/exec")
    CompletionStage<JsonNode> exec(JsonNode body);
}

// application.properties
quarkus.rest-client.moogo.url=https://api.moogo.dev/p/<project-id>
quarkus.rest-client.moogo.scope=javax.inject.Singleton
```

## Testing

```java
// MockWebServer (OkHttp) for testing
try (MockWebServer server = new MockWebServer()) {
    server.enqueue(new MockResponse()
        .setResponseCode(200)
        .setBody("{\"success\":true,\"columns\":[\"id\"],\"rows\":[[\"u1\"]],\"row_count\":1}"));
    server.start();

    System.setProperty("MOOGO_PROJECT_URL", server.url("/").toString());
    // run tests...
}
```

## GraalVM Native Image

```bash
# Spring Boot 3+ / Quarkus / Micronaut support native compilation
./mvnw -Pnative native:compile
# or
./gradlew nativeCompile
```

The `java.net.http.HttpClient` works in native images (since Java 17).

## Next

- [Go guide](/docs/guides/go)
- [Ruby/Rails guide](/docs/guides/ruby-rails)
- [Python guide](/docs/guides/python-vanilla)
- [SQL API reference](/docs/sql-api)
- [Object storage](/docs/object-storage)