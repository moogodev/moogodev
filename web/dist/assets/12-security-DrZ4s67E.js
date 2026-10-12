var e=`# Security

This page explains how Moogo is built to fail safely, and — just as importantly —
what the model does **not** protect you from.

## Multi-tenancy

Each project maps to one SQLite file:

\`\`\`
/data/dbs/{project_id}.db
/data/buckets/{project_id}/{key}
\`\`\`

Isolation comes from the filesystem, not from a policy. There is no shared table and no \`tenant_id\` column to forget in a \`WHERE\` clause, because there is no shared table.

### The path is validated, not trusted

\`project_id\` comes from a URL, and a URL is untrusted input. It is validated as a
UUID before anything else happens, and the on-disk path is then **rebuilt from the
validated components** rather than assembled from the raw string.

That is the structural reason path traversal is impossible here: there is no code
path where raw input becomes a path.

A malformed id returns \`400 invalid_project_id\` before any lookup happens.

### Ownership is checked per request

All API endpoints verify that the authenticated user owns the project before
performing any operation. This check is enforced at the request level, not just at
the database level.

### Sensitive names are blocked

To prevent accidental invocation of dangerous SQL functions, Moogo blocks certain
names from being used as column names or identifiers in SQL queries. This is a
defense-in-depth measure: even if an application inadvertently uses a blocked name,
the server will reject the request.

**Daftar nama yang sensitif (tidak boleh dipakai sebagai nama kolom/identifikasi)**:

- \`readfile\`
- \`writefile\`
- \`delete\`
- \`vacuum\`
- \`attach\`
- \`detach\`
- \`reindex\`
- \`analyze\`
- \`pragma\` (saat digunakan sebagai nama identitas)

**Catatan**:

- Pemblokiran ini hanya berlaku untuk nama kolom/identifikasi dalam query SQL,
  bukan untuk nilai data.
- Pemblokiran ini bertujuan mencegah eksekusi fungsi berbahaya secara tidak sengaja.
- Daftar ini bisa diperluas dalam masa mendatang; pengembang sebaiknya tidak mengandalkan nama kolom yang mungkin bergeser.

## Sensitive names are blocked

To prevent accidental invocation of dangerous SQL functions, Moogo blocks certain names from being used as column names or identifiers in SQL queries. This is a defense-in-depth measure: even if an application inadvertently uses a blocked name, the server will reject the request.

**Blocked names list**:

- \`readfile\`
- \`writefile\`
- \`delete\`
- \`vacuum\`
- \`attach\`
- \`detach\`
- \`reindex\`
- \`analyze\`
- \`pragma\` (when used as an identity)

**Note**:

- This blocking only applies to column names/identifiers in SQL queries, not to data values.
- This blocking is a defense-in-depth measure to prevent accidental invocation of dangerous functions.
- This list may be expanded in the future; developers should avoid using column names that may shift.

## The path is validated, not trusted

\`project_id\` comes from a URL, and a URL is untrusted input. It is validated as a
UUID before anything else happens, and the on-disk path is then **rebuilt from the
validated components** rather than assembled from the raw string.

That is the structural reason path traversal is impossible here: there is no code
path where raw input becomes a path.

A malformed id returns \`400 invalid_project_id\` before any lookup happens.

### Ownership is checked per request

All API endpoints verify that the authenticated user owns the project before
performing any operation. This check is enforced at the request level, not just at
the database level.`;export{e as default};