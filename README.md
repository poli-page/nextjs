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

- Node.js `>=18.18.0`
- Next.js `>=13.4.0` (App Router)
- TypeScript `>=5.4` (optional, but the public types assume it)

## Install

```bash
npm install @poli-page/nextjs @poli-page/sdk
```

Set your key — Next.js loads the project-root `.env` automatically:

```bash
# .env
POLI_PAGE_API_KEY=pp_test_...
```

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
    version: '1.0.0',
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
| `POLI_PAGE_API_KEY` | required | Must start with `pp_test_` or `pp_live_`. |
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

The no-arg form (`createPoliPageClient()`) memoises one instance per API key; passing options bypasses the memo.

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

`createPoliPageRouteHandler` catches `PoliPageError` and turns it into a JSON `Response` (`{ code, message, requestId }`) with the SDK's status code; 4xx stays 4xx, 5xx stays 5xx, network/timeout becomes 502. Anything else bubbles to your `error.tsx` boundary.

```ts
// app/invoices/[id]/route.ts
import { PoliPageError } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler(async ({ client }) => {
  try {
    return await client.render.pdf({ project: 'billing', template: 'invoice', version: '1.0.0', data: {} })
  } catch (err) {
    if (err instanceof PoliPageError && err.isRateLimitError()) {
      return new Response('Slow down', { status: 429, headers: { 'Retry-After': '60' } })
    }
    throw err
  }
})
```

Pass `options.onError` to intercept errors before the default mapping.

## Example app

A Next 15 App Router demo lives in [`example-app/`](example-app/). It covers every SDK demo step (`render.pdf`, `render.pdfStream`, `render.preview`, `documents.create`, `documents.get` redirect, `documents.thumbnails`, `documents.preview`, `documents.delete`, plus an `INVALID_VERSION_FORMAT` route) and includes an interactive dashboard at `/` and a standalone `npm run render-to-file` script.

```bash
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
| `0.1.x` | `>=13.4.0` (App Router); CI runs `^14` and `^15` | `>=18.18.0` (`18` / `20` / `22`) |

Pages Router is not supported. The package ships dual ESM + CJS and runs in both the Node and Edge runtimes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Released under the MIT License — see [LICENSE](LICENSE).
