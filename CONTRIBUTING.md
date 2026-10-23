# Contributing

Moogo is MIT licensed, written in Go with a React frontend. Contributions are
welcome — especially documentation that is clearer than what is here, bug
reports with a reproduction, and frontend work (the dashboard is the most open
area).

## Before you start

- Read [Feedback](https://moogo.dev/docs/feedback) — it says what makes a
  report or request actionable, and lists the decisions that are already made
  (triggers, `ATTACH`, and friends) so you do not have to relitigate them.
- Search [existing issues](https://github.com/moogodev/moogodev/issues) first.
- For security issues, stop and follow [SECURITY.md](SECURITY.md) instead.

## The shape of a good change

- **Small and focused.** One problem per pull request.
- **Describe the problem, not only the mechanism.** The reviewer should be able
  to tell what got better and why.
- **Match the surrounding code.** The file you are editing already shows the
  style, naming, and comment density it wants.

## Verify before you push

```bash
# Backend
go build ./... && go vet ./...
MOOGO_TEST_DATABASE_URL='postgres://user:pass@localhost:5432/moogo_test?sslmode=disable' \
  go test -race ./...

# Frontend (in web/ui)
npm run build
npm run lint
npm run verify:docs
```

Two things that trip people up:

- **`web/dist` is committed.** The Go binary embeds it, so a frontend change
  means `npm run build` and committing the rebuilt `web/dist` alongside
  `web/ui`.
- **Formatting.** Run `gofmt -w` on Go files you touched. A handful of files in
  the tree are already unformatted; leave those as they are unless your change
  is about them.

## Docs are part of the product

The manual ships inside the product at `/docs`. If your change alters behaviour
a page describes, change the page in the same pull request.

The source is `web/ui/src/content/docs/`. Two flattened copies exist so that
anything which does not run JavaScript — an AI agent, a link preview, `curl` —
reads the same text:

- `internal/docs/files/*.md` — embedded in the binary, served at
  `/api/docs/<slug>`. Regenerate with `scripts/sync-docs.sh` after editing the
  source; the files are named `<slug>.md`, without the numeric prefix that only
  orders the sidebar.
- `web/dist/docs/*.md` — written by `npm run build` (see
  `web/ui/scripts/build-llms.mjs`), served at `/docs/<slug>.md`.

Edit the source, then run `scripts/sync-docs.sh`, then rebuild the frontend so
`web/dist` is committed alongside it.
