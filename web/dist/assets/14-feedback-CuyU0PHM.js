var e=`# Feedback

Moogo is built in public and shaped by what people actually try to do with it.
Feedback is genuinely useful here — especially the parts that were unclear.

## Where to send it

### Bugs and feature requests

[Open an issue](https://github.com/moogodev/moogodev/issues/new/choose) on the
project's GitHub repository — the templates ask for exactly the fields listed
below. Issues are the fastest route, and everything is tracked publicly.

When reporting something, include:

- **What you did** — the request or the steps in the dashboard.
- **What you expected.**
- **What happened instead.**
- **The \`code\` from the error envelope**, if there was one. See
  [Errors](/docs/errors).
- **Which surface it happened on** — dashboard, SQL API, or storage API.

That last one matters, because the dashboard and the public API are separate
authorization paths over shared handlers. A difference between them is a real
signal, not noise.

Never paste a secret key into an issue. If you have already, rotate it first —
see [Credentials](/docs/credentials#if-a-credential-leaks).

### Security vulnerabilities

Please report security issues privately rather than in a public issue. The
channels are the project's
[security policy](https://github.com/moogodev/moogodev/security/policy):

- **Email** — [moogo.dev@gmail.com](mailto:moogo.dev@gmail.com), subject
  \`[SECURITY]\`.
- **GitHub Security Advisories** — a private report against the repository.

Include what is affected, how to reproduce it, and the impact you believe it
has. You will get an acknowledgement.

### Documentation problems

If a page here is wrong, out of date, or just confusing, that is a bug worth
reporting. Documentation corrections are credited, and "this step did not work as
written" is one of the most useful things you can send.

## What is genuinely useful

The most valuable reports are the ones that describe a **task you were trying to
complete**, not a feature you would like.

> "I tried to upload avatars from a Cloudflare Worker. The docs say to use
> \`url\`, but that needs a credential a browser cannot send, so I had to publish
> every avatar. What is the right pattern?"

That tells us something specific. "Add more file types" does not.

## What tends not to be actionable

- **"It's slow."** Duration is returned in every SQL response and shown in the
  console. The \`duration_ms\` value, the statement, and the row count are enough to
  start.
- **"Add support for X."** Genuinely considered when it fits the design, but much
  more useful with a description of what you would build with it.
- **Requests for more quota or a paid tier.** There is no billing in this version,
  so every account shares the same limits. Feedback here is noted.

## Things already decided, and why

So you do not have to ask, and so the reasoning is on the record:

| Request | Answer |
|---|---|
| Triggers | Declined. Detecting them needs a real parser, and a hand-rolled check fails open on valid SQLite. Write invariants in application code. |
| \`ATTACH\` | Declined. It would make the write endpoint a file reader for the whole host. |
| Idle auto-pause | Not a feature. Projects stay on, so there is no cold start. Pause deliberately if you want. |
| More storage credentials | Capped at 5 per project. Revoke unused ones. |
| The project key for storage | Deliberately refused. They guard different things. |
| Password reset | Supported — see [Register](/docs/register#forgotten-password). |

## Contributing

Moogo is MIT licensed and written in Go with a React frontend. Contributions are
welcome, especially:

- Documentation that is clearer than what is here.
- Bug reports with a reproduction.
- Frontend work — the dashboard is the most open area.

Keep changes small and focused, and describe the problem being solved rather than
only the mechanism.

## Roadmap

Roughly, in order:

1. **Self-hosting** — an installer and a Docker image, so you can run it yourself.
2. **More quota**, with billing behind it.
3. **Official SDKs** — JavaScript, Python, Go.
4. **Range requests and cache headers** on object downloads.
5. **Additional OAuth providers.**

Multi-node and cross-region replication are the biggest architectural changes
still ahead. The groundwork is in place — the control plane and data plane are
already separate, and the project id lives in the URL — so routing to another node
does not change the shape of the API. See [Why Moogo](/docs/why-moogo) for the
reasoning.

## Thank you

Every account, every issue, and every "this confused me" message has shaped this.
The [errors page](/docs/errors) in particular is built almost entirely from real
reports, and the distinction between \`object_too_large\` and \`quota_exceeded\` exists
because someone could not tell which one they had hit.

## Next

- [What is Moogo](/docs/what-is-moogo) — back to the beginning
- [Quickstart](/docs/quickstart) — make a query in two minutes`;export{e as default};