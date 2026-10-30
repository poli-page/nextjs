# @poli-page/nextjs

> Render Poli Page documents from Next.js App Router route handlers.

## About

This package adapts [Poli Page](https://poli.page) to the Next.js App Router. You get a memoised SDK client that reads `POLI_PAGE_*` from `process.env`, a route handler factory that turns one async function into a `GET`/`POST` export with the right PDF headers, and response helpers (`pdfResponse`, `previewResponse`, `documentRedirectResponse`) you reach for when you keep your own handler signature. Everything in `src/` is Web-standards-only, so the same exports run on Node and on the Edge runtime.

**When to use this:**

- You want a `route.ts` handler that returns a PDF in one line.
- You target the Edge runtime and need a `fetch`-based client.
- You return streamed PDFs and want backpressure honoured end-to-end.

**When not to:**

- You're on the Pages Router — this package targets App Router only.
- You want a drop-in `<PoliPagePDF />` React component or a `next.config.js` plugin; this package ships neither.

## Requirements

- Node.js `>=20.18.0`
- Next.js `>=13.4.0` (App Router)
- [`@poli-page/sdk`](https://www.npmjs.com/package/@poli-page/sdk) `^0.11.0` (installed with the package): environment keys, no template versions
- TypeScript `>=5.4` (optional, but the public types assume it)

## Install

```bash
npm install @poli-page/nextjs @poli-page/sdk
```

Set your key — Next.js loads the project-root `.env` automatically:

```bash
# .env
POLI_PAGE_API_KEY=pp_sandbox_...
```

An API key is `pp_{environment}_{32 hex characters}`. The environment it belongs to decides what a render does ("Counted" means the render counts toward the organization's monthly PDF quota):

| Environment                           | Key            | Watermark | Counted |
| ------------------------------------- | -------------- | --------- | ------- |
| `sandbox` (every org)                 | `pp_sandbox_…` | yes       | no      |
| `live` (every org, deletable on Pro+) | `pp_live_…`    | no        | yes     |
| created on Pro+ (e.g. `staging`)      | `pp_staging_…` | no        | yes     |

Next.js has no per-app CLI smoke test; the example app's `npm run dev` plays that role (see **Example app**).

## Quick start

```ts
// app/welcome/[name]/route.ts
import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler<{ name: string }>(async ({ client, params }) => ({
  kind: 'pdf',
  bytes: await client.render.pdf({
    project: 'getting-started',
    template: 'welcome',
    data: { name: params.name },
  }),
  filename: `welcome-${params.name}.pdf`,
}))
```

`GET /welcome/world` returns a PDF rendered from the public `getting-started/welcome` template. The factory sets `Cache-Control: no-store, private`, an RFC 5987 `Content-Disposition`, `X-Content-Type-Options: nosniff`, and maps any thrown `PoliPageError` to a typed JSON response.

## Configuration

You configure the client through environment variables or by passing options to `createPoliPageClient`. Explicit options always win.

| Variable | Default | Description |
|---|---|---|
| `POLI_PAGE_API_KEY` | required | Your API key, for example `pp_sandbox_…`. A missing or empty key throws. A key that does not match `pp_{environment}_{32 lowercase hex characters}` logs one warning that names the expected format and shows no part of the key, and the client starts anyway: the API decides whether the key is valid (`401 INVALID_API_KEY`). |
| `POLI_PAGE_BASE_URL` | SDK default | Override the API host. |
| `POLI_PAGE_TIMEOUT` | SDK default | Per-request timeout in milliseconds. |
| `POLI_PAGE_MAX_RETRIES` | SDK default | Maximum retry attempts on retryable failures. |
| `POLI_PAGE_RETRY_DELAY` | SDK default | Base delay between retries, in milliseconds. |

```ts
// lib/poli-page.ts
import { createPoliPageClient } from '@poli-page/nextjs'

export const poliPage = createPoliPageClient({
  timeout: 30_000,
  maxRetries: 3,
})
```

The no-arg form (`createPoliPageClient()`) keeps the client built from the current environment configuration (the `POLI_PAGE_*` variables above) and builds a new one when it changes; passing options bypasses the memo.

## API at a glance

| Symbol | Purpose |
|---|---|
| `createPoliPageClient(options?)` | Build (or return the memoised) SDK client from env or explicit options. |
| `createPoliPageRouteHandler(handler, options?)` | Wrap an async handler into an App Router `GET`/`POST` export. |
| `pdfResponse(body, options?)` | Build a `Response` with PDF headers from bytes or a `ReadableStream`. |
| `previewResponse(html)` | Build a `text/html; charset=utf-8` response for HTML previews. |
| `documentRedirectResponse(url, options?)` | Build a 302 (or 308) to a presigned document URL. |
| `PoliPageError` | Re-export of the SDK error class with `isAuthError()` / `isRateLimitError()` / `isValidationError()` / `isNetworkError()` predicates. |

Full reference: [docs/api.md](docs/api.md).

## Errors

The SDK raises a single `PoliPageError` class. You discriminate failure modes through its predicate methods, which align with the shared taxonomy:

- **Auth** — `err.isAuthError()` (HTTP 401 / 403).
- **Rate limit** — `err.isRateLimitError()` (HTTP 429, after the SDK's internal retries).
- **Request rejected** — `err.isValidationError()` (HTTP 400) or any 4xx/5xx with a render-related `code`.
- **Network / transport** — `err.isNetworkError()` (DNS, connection refused, TLS, timeout — no `status`).

### Error handler

`createPoliPageRouteHandler` handles `PoliPageError` by default: it answers with the SDK's `err.toPayload()` as the JSON body (`Content-Type: application/json`, `Cache-Control: no-store, private`):

```json
{ "code": "TEMPLATE_NOT_FOUND", "message": "Template 'does-not-exist' not found in project 'getting-started'.", "status": 404, "requestId": "req_…" }
```

| Error | HTTP status | Body `status` |
|---|---|---|
| API error (4xx, 5xx) | the API's status | the API's status |
| `network_error` | `503` | `503` |
| `timeout` | `504` | `504` |
| SDK error with no status (e.g. `aborted`) | `500` | `null` |

`requestId` is the API's `x-request-id`, or `null` when there is none. Anything that is not a `PoliPageError` bubbles to Next.js as usual.

A stream result (`{ kind: 'stream' }` or a bare `ReadableStream`, e.g. from `render.pdfStream()`) is read up to its first chunk before the response is built, so an error the stream raises before any byte (such as `DOWNLOAD_FAILED`) is answered the same way. An error after the first chunk aborts the response, so a truncated PDF never looks complete.

To handle the errors yourself, turn it off for a route with `handleErrors: false`: the `PoliPageError` is then rethrown, and Next.js answers it like any other error. `options.onError` runs first either way, and a `Response` it returns is used as the answer.

```ts
export const GET = createPoliPageRouteHandler(handler, { handleErrors: false })
```

Or catch a specific error inside the handler:

```ts
// app/invoices/[id]/route.ts
import { createPoliPageRouteHandler } from '@poli-page/nextjs'
import { PoliPageError } from '@poli-page/sdk'

export const GET = createPoliPageRouteHandler(async ({ client }) => {
  try {
    return await client.render.pdf({ project: 'billing', template: 'invoice', data: {} })
  } catch (err) {
    if (err instanceof PoliPageError && err.isRateLimitError()) {
      return new Response('Slow down', { status: 429, headers: { 'Retry-After': '60' } })
    }
    throw err
  }
})
```


## Example app

A Next 15 App Router demo lives in [`example-app/`](example-app/). It covers every SDK demo step (`render.pdf`, `render.pdfStream`, `render.document`, `documents.get` redirect, `documents.thumbnails`, `documents.preview`, `documents.delete`, plus a `GET /errors/not-found` route that answers `404 TEMPLATE_NOT_FOUND`) and includes an interactive dashboard at `/` and a standalone `npm run render-to-file` script.

It depends on this repository's package (`file:..`), so build the package first:

```bash
npm install && npm run build
cd example-app
npm install
npm run dev
```

## Going further

- `docs/edge.md` — Edge runtime: opt in with `export const runtime = 'edge'` and what stays portable. *(forthcoming)*
- `docs/streaming.md` — Streaming large PDFs end-to-end with `client.render.pdfStream`. *(forthcoming)*
- `docs/server-components.md` — Embedding rendered bytes from a Server Component. *(forthcoming)*
- `docs/events.md` — Wiring `onRequest` / `onResponse` / `onRetry` hooks for observability. *(forthcoming)*

## Compatibility

| Package | Next.js | Node |
|---|---|---|
| `0.1.x` | `>=13.4.0` (App Router); CI runs `^14` and `^15` | `>=20.18.0` (`20` / `22`) |

Pages Router is not supported. The package ships dual ESM + CJS and runs in both the Node and Edge runtimes.

## Contributing

`npm run typecheck`, `npm run lint`, `npm run build` and `npm test` are what CI runs.

### Contract tests

`tests/contract/contract.test.ts` runs the integration cases (`impl.*`) of the [Poli Page API contract](https://github.com/poli-page/api-contract) against the example app, served by a Next.js production server started from its build, with its SDK pointed at a local mock API. CI runs them against the contract version pinned in `.github/workflows/ci.yml`. Locally, build the package and the example app, then point `POLI_CONTRACT` at a `contract.json` (without it, the contract tests are skipped):

```bash
npm run build && (cd example-app && npm ci && npm run build)
POLI_CONTRACT=/path/to/contract.json npm test
```

`tests/contract-skip.json` lists the cases allowed to fail, each with its reason. The example app always runs on its own locked Next.js 15 (it uses `next.config.ts` and `typedRoutes`, which need Next 15), so on the Next 14 CI legs only the unit tests and the typecheck run against Next 14.

## License

Released under the MIT License — see [LICENSE](LICENSE).
