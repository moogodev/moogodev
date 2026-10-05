# Frontend

The web UI is a React single-page app built with Vite and Tailwind CSS. It is
embedded into the Go binary from `dist/`, so a deployment is still one file.

```
web/
  web.go        //go:embed all:dist, exposes Dist()
  ui/           Vite + React + TypeScript source (not embedded)
  dist/         built output, committed, embedded
```

## Pages

| Route | Page |
|---|---|
| `/` | Landing page |
| `/login` | Sign in with Google |
| `/app` | Dashboard: projects, create, rotate key, delete |
| `/docs`, `/docs/:slug` | Documentation |

`/`, `/login`, `/app`, `/app/*`, `/docs`, and `/docs/*` all return the same
`dist/index.html`; React Router picks what to render. The rest of the API lives
under `/api`, `/auth`, and `/db`.

## Build

```
cd web/ui
npm install
npm run build      # writes ../dist
```

Run `npm run build` before `go build` whenever `web/ui` changes, then commit
`web/dist` so the embedded copy matches the source.

## Constraints

The Go server sends a strict CSP with no `'unsafe-inline'` for scripts or
styles. That means:

- scripts and styles are external files, never inline;
- no inline `style` attributes, so dynamic styling uses classes, not React
  `style` props;
- Vite is configured to inline nothing (`assetsInlineLimit: 0`) and to skip the
  module-preload polyfill.

Assets are served under `/static/`, which is why `base` is `/static/` in
`vite.config.ts`.
