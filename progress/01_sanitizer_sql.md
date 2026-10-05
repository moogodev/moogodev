# Progress 5 — Sanitizer SQL

Status: **selesai**
Target: `pkg/sanitizer/`

---

## Kenapa ini paling penting

`/db/{project_id}/exec` menerima DDL dan DML dari user. Tanpa sanitizer,
endpoint itu menjadi **file-read primitive untuk seluruh server**:

```sql
ATTACH DATABASE '/etc/passwd' AS leak;
SELECT * FROM leak.sqlite_master;
```

Kata `ATTACH` untuk SQLite berarti "buka file ini sebagai database". Karena
file database punya header, SQLite akan membacanya — dan kalau attacker
tahu nama file, `SELECT` following-nya mengembalikan isi file sebagai baris.

Masalah yang sama berlaku untuk:

- `readfile('/etc/passwd')` — fungsi bawaan SQLite untuk baca file
- `writefile('/path', 'data')` — menulis file ke server
- `load_extension` — memuat shared library

Semuanya berakar dari satu keputusan: `/exec` harus menerima DDL, jadi tidak
bisa dibatasi hanya pada INSERT dan UPDATE.

## Yang harus dibangun

### Tokenizer

Langkah pertama sebelum keputusan apa pun. Pemeriksaan dilakukan di atas token,
bukan di atas string mentah.

Alasannya: `strings.Contains(query, "ATTACH")` akan menolak query yang sah
seperti:

```sql
SELECT note FROM orders WHERE note = 'please attach receipt';
CREATE TABLE attachments (id int);
```

Keduanya tidak berbahaya. Matcher berbasis substring akan menolak query sah,
membuat developer frustrasi lalu mencari cara_disable sanitization, yang justru
membuka celah baru. Tokenizer membuat pemeriksaan tepat sasaran.

Tokenizer harus menangani:

- String literal `'...'` dengan escape `''`
- String literal `"..."` dan backtick untuk identifier
- Blok komentar `/* ... */`
- Baris komentar `-- ...` sampai newline
- Operator dan tanda baca sebagai token sendiri

### Aturan penolakan

| Aturan | Alasan |
|---|---|
| Satu statement per request | `SELECT 1; DROP DATABASE x` lolos prepared statement |
| Tolak `ATTACH` / `DETACH` | File-read primitive |
| Tolak `readfile` / `writefile` | Akses file |
| Tolak `load_extension` | Beban kode native |
| Tolak `PRAGMA` yang mengubah file | `journal_mode`, `key`, `rekey` menyentuh file |

Pengecekan `PRAGMA` harus whitelist, bukan blacklist: hanya `table_info`,
`index_list`, `foreign_key_list`, `database_list` yang berguna untuk dashboard.

### Bentuk error

Error harus informatif untuk developer yang memakai API, tapi tidak
membocorkan struktur internal. Bentuk: `{code, message}` dengan code
mesin-terbaca seperti `sql_forbidden_statement`.

## Yang sudah

Berkas:
- `pkg/sanitizer/tokenizer.go` — lexer SQL
- `pkg/sanitizer/keywords.go` — daftar keyword, fungsi terlarang, allowlist PRAGMA
- `pkg/sanitizer/sanitizer.go` — aturan validasi + bentuk error
- `pkg/sanitizer/sanitizer_test.go` — 78 subtest

### Yang ditolak

| Input | Kode error |
|---|---|
| `ATTACH` / `DETACH` | `sql_forbidden_keyword` |
| `readfile` / `writefile` / `load_extension` | `sql_forbidden_function` |
| `PRAGMA journal_mode = WAL` | `sql_forbidden_pragma` |
| `VACUUM` / `ANALYZE` / `REINDEX` | `sql_forbidden_keyword` |
| `BEGIN` / `COMMIT` / `ROLLBACK` / `SAVEPOINT` | `sql_forbidden_keyword` |
| `CREATE TRIGGER` | `sql_forbidden_keyword` |
| `SELECT 1; SELECT 2` | `sql_multiple_statements` |
| String tak tertutup | `sql_syntax_error` |
| Lebih dari 64 KB | `sql_too_long` |

### Yang tetap diterima

Query sah yang mengandung kata terlarang **tidak ditolak**, dan ini yang diuji
secara eksplisit:

```sql
SELECT note FROM orders WHERE note = 'please attach receipt';
CREATE TABLE attachments (id INTEGER PRIMARY KEY);
INSERT INTO notes (body) VALUES ('first; second');
PRAGMA table_info(users);
SELECT 'it''s here';
```

Kalau versi pertamanya ditolak, developer akan mencari cara melewati sanitasi,
dan itu justru membuat lubang baru.

### Keputusan yang diambil saat menulis

**`CREATE TRIGGER` ditolak.** Body trigger berada antara `BEGIN` dan `END` dan
mengandung titik koma, sehingga tidak bisa dibedakan dari injeksi
multi-statement tanpa parser yang benar-benar menelusuri nesting. Menulis
parser IWOCAIM secara manual justru jenis pemeriksaan yang gagal terbuka pada
input yang diterima SQLite tapi tidak dipahami kode kita. Trigger tidak
berguna untuk dashboard, jadi fiturnya ditolak, bukan risikonya ditanggung.

**`PRAGMA` memakai allowlist, bukan denylist.** Ada pragma yang menulis ke file
dan jumlahnya panjang (`journal_mode`, `key`, `rekey`, `page_size`,
`auto_vacuum`, `synchronous`). Denylist harus terus mengejar. Allowlist juga
yang membuat schema inspector dashboard tetap berfungsi.

**`ANALYZE` dan `REINDEX` ditolak** bersama `VACUUM`, karena ketiganya menulis
ulang file dan bisa melewati batas 100 MB per write biasa.

### Bug yang tertangkap test

Empat bug ketahuan saat test pertama dijalankan, semuanya soal pencocokan:

1. Nilai token di-uppercase, key map lowercase, jadi `readfile` lolos karena
   dicek sebagai `READFILE`
2. `ANALYZE` tidak ada di `sqlKeywords`, jadi ter-lex sebagai identifier dan
   lolos dari pemeriksaan keyword
3. `PRAGMA table_info` gagal: `table_info` ter-lex jadi dua token (`TABLE` +
   `_info`), harus dirakit ulang dari posisi token
4. `CREATE TRIGGER` dianggap multi-statement

## Yang belum

- [ ] Batas panjang per-argumen (masalahnya belum ganz: prepared statement
      sudah membound nilainya)
- [ ] Integrasi ke handler `/db/{id}/exec`

## Catatan lanjutan

Tokenizer ini sengaja bukan parser lengkap. Yang penting: regex untuk SQL
selalu salah di kasus tepi, dan kegagalan berarti kebocoran. Manual, sekitar 250 baris,
dan bisa dibaca seluruhnya.

Kalau nanti butuh validasi lebih dalam, `modernc.org/sqlite` menyediakan
`sqlite3_complete()` untuk detensi kelengkapan string, tapi itu memeriksa
kelengkapan string bukan semantik, jadi tidak menggantikan apa yang di sini.

Penting untuk diingat: validasi lolos **tidak** berarti SQL itu aman dalam
semua arti. Yang dijamin adalah statement tunggal yang tidak menyentuh file
di luar file project. Batas ukuran dan konkurensi tetap ditegakkan lapisan
di bawahnya.