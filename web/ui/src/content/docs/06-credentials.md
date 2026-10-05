# Credentials

Moogo uses **different credentials for different things**, on purpose. This page
covers what each one authorises, how to send it, and what happens if it leaks.

## The three credentials

| Credential | Authorises | Sent as |
|---|---|---|
| **Session cookie** | The dashboard, as you | `Cookie`, set by the browser |
| **Project key** | SQL (`/query`, `/exec`) | `Authorization: Bearer moogo_...` |
| **Storage credential** | Object storage | `X-Moogo-Access-Key-Id` + `Authorization: Bearer moogo_sk_...` |

They are not interchangeable. The dashboard never sees a project key, the project
key cannot touch storage, and a storage credential cannot run SQL. Each one is
scoped to the job it is named for.

## Project key

Issued when a project is created, and again whenever you rotate. Format:

```
moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK
```

The prefix is `moogo_` followed by 32 bytes of base64 from `crypto/rand`. The
prefix means a key found in a log can be identified as a Moogo key.

### Send it like this

```bash
Authorization: Bearer moogo_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK
```

Only the `Bearer` scheme is accepted. Basic auth and custom schemes are refused,
so there is no second path into the API.

### Shown once

The plaintext key appears in exactly one response: the one that created it, or
the one that rotated it. What is stored is:

- a **SHA-256 hash**, used for verification
- an **eight-character prefix**, so you can tell your keys apart in the list
- the time it was last rotated

There is no endpoint that returns the key. This is not a policy that could be
changed later — the server does not hold a value it could give back.

The hash is unsalted SHA-256, which is correct here: the key already has 256 bits
of entropy from `crypto/rand`, so there is no guessing space for a salt to close.
Comparison is constant-time, so verification does not leak how many bytes matched.

### Rotating a key

In the project's **Settings** tab, click **Rotate key**.

The new key is shown once. The old key stops working **immediately** — there is
no grace period, so update your deployment before you rotate:

1. Update the secret in your deployment.
2. Restart or redeploy so the new value is live.
3. Confirm the application still works.
4. Only then, if you want to be certain the old value is gone, verify the old key
   now returns `401`.

If you rotate and then discover your deployment cannot pick up environment
changes, the project is still fully usable from the dashboard — you only need to
rotate again.

### Storage credential for one job

If several parts of your system need the SQL key, consider
[rotating per environment](/docs/credentials#storage-credentials) instead of
sharing one key across everything.

## Storage credentials

Storage has its own credential type, following the shape of Cloudflare R2: an
**access key id** that is safe to display, and a **secret key** that is not.

```
moogo_ak_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK   <- access key id (public)
moogo_sk_3nQ8wRtZ2mK5xB9cV1yH4jL7pA0sD6fG2iO7uE   <- secret key (private)
```

The distinct prefixes mean that if you ever see both in a log, you know which is
which without reading further.

### Why not just use the project key?

Because the two guard different things:

- A key scoped to running `SELECT` has no business being able to overwrite every
  file in the project.
- Rotating the SQL key should not be able to silently break every application that
  uploads files.

So storage **rejects** the project key, and the SQL endpoints reject the storage
credential.

### Create one

In the project's **Bucket** tab, open **Credentials** and click **Create
credential**. Give it a label so you can tell environments apart — `production`,
`staging`, `ci`.

The secret is returned exactly once, together with ready-to-paste environment
variables:

```json
{
  "access_key_id": "moogo_ak_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK",
  "secret_access_key": "moogo_sk_3nQ8wRtZ2mK5xB9cV1yH4jL7pA0sD6fG2iO7uE",
  "env": {
    "MOOGO_BUCKET_ENDPOINT": "https://moogo.dev",
    "MOOGO_BUCKET_ACCESS_KEY_ID": "moogo_ak_9Fk2xQmZ7pR4tYvB1nC6wD8sH3jL5gA0eU2iO7fK",
    "MOOGO_BUCKET_SECRET_KEY": "moogo_sk_3nQ8wRtZ2mK5xB9cV1yH4jL7pA0sD6fG2iO7uE"
  }
}
```

**Copy it immediately.** Like the project key, it is shown once.

### Use it

Two headers, on every storage request:

```bash
curl https://moogo.dev/p/$MOOGO_PROJECT_ID/bucket/avatars/kit.png \
  -H "X-Moogo-Access-Key-Id: $MOOGO_BUCKET_ACCESS_KEY_ID" \
  -H "Authorization: Bearer $MOOGO_BUCKET_SECRET_KEY"
```

Not AWS Signature V4, deliberately. Signing exists so a client can prove
possession of a secret without sending it, for a transport the client does not
control. Over TLS the secret goes in the `Authorization` header the same way it
does everywhere else in this API, and the access key id says which credential to
check it against.

### Limits and lifecycle

- You may hold **5 credentials** per project.
- **Rotating** keeps the same access key id and issues a new secret. Use this when
  only the secret is compromised.
- **Revoking** disables the credential permanently. Use this when the whole
  credential is compromised.

An unknown id, a revoked id, and a wrong secret all return `401`, deliberately
indistinguishable, so the endpoint cannot be used to discover which access key ids
are valid.

A credential belongs to exactly one project. Presenting project A's credential
against project B's URL returns `404`, not someone else's data.

### Keeping one credential per environment

A pattern worth copying:

| Credential | Used by | Scope it can reach |
|---|---|---|
| `web-ssr` | your server | full storage |
| `ci-uploads` | your test pipeline | full storage, revokable at any time |
| `public-site` | a static build step | full storage, revoke before going live |

This means a leaked CI variable does not stay live in production, and revoking one
environment does not take down the others.

## If a credential leaks

Treat a leaked key as a real incident. In order:

1. **Rotate or revoke immediately.** Project key: **Settings → Rotate key**.
   Storage: **Credentials → Rotate** or **Revoke**.
2. **Update every deployment** that was using it.
3. **Review the [activity log](/docs/dashboard#activity-log)** for requests you do
   not recognise.
4. **Check for other exposure** — a leaked key in a public repository stays
   exposed even after you rotate, because the history does not go away. Treat it
   as compromised from the moment it was pushed, not from the moment you noticed.

Rotating is cheap. Do not wait to be sure.

## What is never stored

- The **raw project key** — only a hash and an eight-character prefix.
- The **raw storage secret** — only a hash and a six-character preview.
- **Passwords** — stored as a salted hash, never in a readable form.

The practical test: if the Postgres control plane were dumped, the attacker would
hold no working credential. They would hold hashes, which cannot be reversed
because the keys are not recoverable in the first place.

## Next

- [SQL API](/docs/sql-api) — using the project key
- [Object storage](/docs/object-storage) — using storage credentials
- [Security](/docs/security) — the full model