# Security Policy

## Reporting a vulnerability

**Do not open a public issue for security reports.** Report privately, through
either channel:

1. **Email** — [moogo.dev@gmail.com](mailto:moogo.dev@gmail.com). Include
   `[SECURITY]` in the subject.
2. **GitHub Security Advisories** —
   [Report a vulnerability](https://github.com/moogodev/moogodev/security/advisories/new)
   if private vulnerability reporting is enabled on the repository.

You will get an acknowledgement.

Include, as far as you have it:

- **What is affected** — dashboard, SQL API, storage API, or the deployment
  itself.
- **How to reproduce it** — the request, the steps, the input.
- **The impact you believe it has** — what an attacker gains, what data is
  reachable.
- **Any error `code` or response** that accompanied it.

If a secret has already leaked, **rotate it first, then report** — see
[Credentials](https://moogo.dev/docs/credentials#if-a-credential-leaks).

## Supported versions

| Version | Supported |
|---|---|
| The deployment at moogo.dev (current `master`) | ✅ |
| Older self-hosted checkouts | Best effort — please upgrade |

## Scope

Moogo's security boundary is deliberately narrow and documented:

- The SQL sanitizer ([Security](https://moogo.dev/docs/security) and
  [SQL API](https://moogo.dev/docs/sql-api#what-is-rejected)) defines what a
  statement may contain. A bypass of that boundary — reaching the filesystem,
  escaping the per-project database, running a second statement in one request —
  is a security issue.
- Multi-tenant isolation: one project reading another project's database,
  storage objects, or credentials is a security issue.
- Authentication and session handling: forging a session, bypassing email
  verification, resetting someone else's password — security issues.
- Everything else (a wrong error message, a confusing UI, a missing feature)
  belongs in a normal issue, not here.

## Thanks

Valid reports are credited in the advisory (your choice), and the fix's history
says who found it.
