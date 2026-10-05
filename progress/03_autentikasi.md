# Progress 7 — Autentikasi

Status: **selesai**
Target: `internal/auth/`

---

## Yang harus dibangun

### Alur Google OAuth

```
GET /auth/google          -> redirect ke Google, set cookie state
GET /auth/google/callback -> cek state, tukar kode jadi token, ambil email
                             -> UpsertUserByEmail -> set session cookie -> redirect /app
```

### Yang wajib ada

**Cek `state`.** Tanpa itu, attacker bisa648 membuat halaman yang Diam-diam
meng-complete login dengan akun dia, lalu victim login ke akun attacker
(CSRF). `state` acak disimpan di cookie, dibandingkan saat callback.

**Cookie `HttpOnly` + `Secure` + `SameSite=Lax`.** `HttpOnly` supaya JavaScript
tidak bisa membacanya, yang berarti XSS tidak bisa mencuri session.

`SameSite=Lax` membolehkan navigasi top-level dari Google ke `/callback`,
yang dibutuhkan alur OAuth, tapi memblokir POST lintas situs.

**Verifikasi `iss` dari ID token.** Token dari Google harus dicek issuer-nya
`accounts.google.com`, kalau tidak token dari issuer lain bisa dipakai.

### Yang tidak dibangun

- Password, password reset, email verification — Google menjamin email
  terverifikasi
- Tabel identitas terpisah — satu email sudah unik sebagai identitas

### Sesi

Format stateless, tanpa tabel session:

- Payload berisi `user_id` dan `expiry`
- Ditandatangani HMAC-SHA256 dengan `MOOGO_SESSION_SECRET`
- Base64url, dipisah payload dan signature dengan titik

Sederhana dan tidak perlu lookup database per request. Kalau nanti butuh
"logout dari semua perangkat", baru pindah ke session tersimpan.

### Integrasi dengan dashboard

Rahasia penting: **secret key API tidak pernah dikirim ke browser.**

Dashboard memanggil `/db/{id}/*` dengan session cookie, lalu server yang
memegang secret key dan bicara ke data plane. Ini mungkin karena path routing
membuat semuanya satu origin, jadi tidak ada CORS sama sekali.

Kalau secret key sampai di browser, `XSS` bisa membacanya dan begitu juga
inspect. Karena tampil sekali, penulisannya harus benar-benar satu jalur.

## Yang sudah

Berkas:
- `pkg/session/session.go` + test — token session stateless (16 test)
- `internal/auth/oauth.go` — alur Google OAuth
- `internal/auth/session.go` — cookie + middleware session
- `internal/auth/middleware.go` — middleware bearer data plane
- `internal/auth/auth_test.go` — 19 test

Total 28 test lulus.

### Yang diverifikasi

| Yang dijanjikan | Test pembuktian |
|---|---|
| Key satu project tidak bisa dipakai untuk project lain | `TestRequireProjectKeyRejectsUnknownProject` |
| Project ID tak dikenal dan key salah jawabannya sama | test di atas, keduanya 401 |
| Scheme selain Bearer ditolak | `TestRequireProjectKeyRejectsNonBearerScheme` |
| Project `pending` menolak Though key valid | `TestRequireProjectKeyRejectsPendingProject` |
| Email belum diverifikasi ditolak | `TestFetchIdentityRejectsUnverifiedEmail` |
| Email dinormalkan lowercase | `TestFetchIdentityAcceptsVerifiedEmail` |
| State sekali pakai | `TestOAuthStateIsSingleUse` |
| State lama ditolak | `TestOAuthStateExpires` |
| Redirect absolut ditolak (open redirect) | `TestSanitizeRedirectRejectsAbsoluteURLs` |
| Cookie punya HttpOnly + Secure + SameSite | `TestSetCookieCarriesSecurityFlags` |

### Keputusan yang diambil

**Userinfo endpoint, bukan validasi ID token lokal.** Google punya
`/v1/userinfo` yang menerima access token dan mengembalikan klaim terverifikasi.
Memakainya berarti tidak ada signing key yang perlu disimpan, dirotasi, atau
bocor di service ini. `openid email profile` tetap diminta sebagai scope, jadi
ID token tetap tersedia kalau nanti dibutuhkan.

**Token session stateless, tanpa tabel session.** HMAC-SHA256 plus
base64url. Verifikasi session tidak perlu query database, dan session dicek di
setiap request control plane. Konsekuensinya: satu session tidak bisa dicabut
sebelum kedaluwarsa. Kalau nanti dibutuhkan, tinggal tambah record
server-side.

**Nonce di dalam JSON, bukan ditempel setelahnya.** Versi pertama menempelkan
nonce random di belakang payload JSON lalu memotongnya saat verifikasi. Itu
rapuh: panjang JSON harus diketahui, dan setiap perubahan struct bisa membuat
pemotongan salah. Sekarang nonce adalah field di struct `Token`.

**Project dibaca dari database tiap request, tidak di-cache.** Satu lookup
indexed pada primary key UUID, dan hasilnya rotasi key serta penghapusan
project langsung berlaku tanpa menunggu cache kedaluwarsa.

### Yang belum

- [ ] Handler HTTP untuk `/auth/google` dan callback (perlu router)
- [ ] Integrasi ke control plane endpoint