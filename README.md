# @poli-page/nextjs

[![CI](https://github.com/poli-page/nextjs/actions/workflows/ci.yml/badge.svg)](https://github.com/poli-page/nextjs/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40poli-page%2Fnextjs.svg)](https://www.npmjs.com/package/@poli-page/nextjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

The official Next.js App Router integration for [Poli Page](https://poli.page) — a thin idiomatic veneer over [`@poli-page/sdk`](https://www.npmjs.com/package/@poli-page/sdk) that turns PDF rendering into a one-liner route handler. First-class Edge runtime, native Web Streams, RFC 5987 filename encoding, and typed error → `Response` mapping included.

## Install

```bash
npm install @poli-page/nextjs @poli-page/sdk
```

Set your API key:

```bash
# .env (Next.js loads this automatically)
POLI_PAGE_API_KEY=pp_test_…
```

## Quick start

`app/invoice/[id]/route.ts`:

```ts
import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler<{ id: string }>(async ({ client, params }) => ({
  kind: 'pdf',
  bytes: await client.render.pdf({
    project: 'billing',
    template: 'invoice',
    version: '1.0.0',
    data: { invoiceId: params.id },
  }),
  filename: `invoice-${params.id}.pdf`,
}))
```

That's the whole handler. The factory takes care of the default `Cache-Control: no-store, private`, the `Content-Disposition` (with non-ASCII filenames RFC 5987-encoded), `nosniff`, and maps any thrown `PoliPageError` to a typed JSON response.

## API surface

### `createPoliPageClient(options?)`

Memoised SDK client. Reads `POLI_PAGE_API_KEY` from `process.env` by default; explicit options bypass the memo. Throws if the key is missing or doesn't start with `pp_test_` / `pp_live_`.

```ts
import { createPoliPageClient } from '@poli-page/nextjs'

const client = createPoliPageClient()                          // env-driven
const dev    = createPoliPageClient({ baseUrl: 'https://api-develop.poli.page' })
```

### `createPoliPageRouteHandler(handler, options?)`

Higher-order function that produces a fully-formed App Router `GET`/`POST` export. The inner handler returns one of:

| Return value | Behavior |
|---|---|
| `Uint8Array` / `ArrayBuffer` | PDF response with sensible defaults |
| `ReadableStream<Uint8Array>` | streamed PDF |
| `{ kind: 'pdf', bytes, filename?, inline? }` | PDF with explicit headers |
| `{ kind: 'stream', stream, filename?, inline? }` | streamed PDF with explicit headers |
| `{ kind: 'preview', html }` | `text/html; charset=utf-8` |
| `{ kind: 'redirect', url, permanent? }` | 302 (or 308) to a presigned URL |
| `Response` | returned as-is |

Pass `{ client }` to override the memoised default, and `{ onError }` to intercept errors before the default `PoliPageError → Response` mapping.

### Response helpers (use these if you keep your own handler signature)

```ts
import { pdfResponse, previewResponse, documentRedirectResponse } from '@poli-page/nextjs'

pdfResponse(bytes, { filename: 'café.pdf' })
//  → application/pdf
//    content-disposition: attachment; filename="caf_.pdf"; filename*=UTF-8''caf%C3%A9.pdf
//    cache-control: no-store, private
//    x-content-type-options: nosniff

previewResponse('<h1>Hi</h1>')                  // text/html; charset=utf-8
documentRedirectResponse(descriptor.presignedPdfUrl)  // 302 + Location
```

## Edge runtime

Opt in by adding one line to your route file:

```ts
export const runtime = 'edge'

export const GET = createPoliPageRouteHandler(async ({ client }) =>
  client.render.pdfStream({ project: 'billing', template: 'invoice', version: '1.0.0', data: {} }),
)
```

Every export touches only Web standards: `fetch`, `Request`, `Response`, `Headers`, `ReadableStream`, `TextEncoder`. No `Buffer`, no `node:*`. Enforced by lint and tested under `@edge-runtime/vm`.

## Streaming

`client.render.pdfStream(input)` returns a `ReadableStream<Uint8Array>` you can hand directly to `pdfResponse` (or return as `{ kind: 'stream' }`):

```ts
export const GET = createPoliPageRouteHandler(async ({ client }) => ({
  kind: 'stream',
  stream: await client.render.pdfStream({
    project: 'billing', template: 'invoice', version: '1.0.0', data: { … },
  }),
  filename: 'invoice.pdf',
  inline: true,
}))
```

No internal buffering — bytes flow from the SDK to the client, backpressure honoured.

## Server Component pattern

There's no `<PoliPagePDF />` component. Inline an iframe from a Server Component yourself when you need it:

```tsx
import { createPoliPageClient } from '@poli-page/nextjs'

export default async function Page() {
  const client = createPoliPageClient()
  const bytes  = await client.render.pdf({ project: 'billing', template: 'invoice', version: '1.0.0', data: {} })
  const b64    = Buffer.from(bytes).toString('base64')  // server-only; not inside @poli-page/nextjs/src
  return <iframe src={`data:application/pdf;base64,${b64}`} style={{ width: '100%', height: '90vh' }} />
}
```

## Error handling

Only `PoliPageError` gets mapped to a JSON `Response`:

| SDK error | HTTP response | Body |
|---|---|---|
| 4xx | same status | `{ code, message, requestId }` |
| 5xx | same status | `{ code, message, requestId }` |
| network / timeout (no status) | 502 | `{ code, message, requestId: null }` |

Anything else bubbles up to your `error.tsx` boundary unmodified — generic exception swallowing destroys observability. Provide `options.onError` for custom mapping of your own errors.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `POLI_PAGE_API_KEY` | required | Must start with `pp_test_` or `pp_live_` |
| `POLI_PAGE_BASE_URL` | SDK default | Set to `https://api-develop.poli.page` for the dev environment |
| `POLI_PAGE_TIMEOUT` | SDK default | milliseconds |
| `POLI_PAGE_MAX_RETRIES` | SDK default | integer |
| `POLI_PAGE_RETRY_DELAY` | SDK default | milliseconds |

Explicit options passed to `createPoliPageClient({ … })` always win.

## Example app

A fully working Next 15 App Router demo lives in [`example-app/`](./example-app/) — nine routes covering every SDK demo step (`render.pdf`, `render.pdfStream`, `render.preview`, `documents.create`, `documents.get` redirect, `documents.preview`, `documents.thumbnails`, `documents.delete`, and an `INVALID_VERSION_FORMAT` triggering route), plus an interactive dashboard at `/` and a standalone `npm run render-to-file` script.

```bash
cd example-app
npm install
npm run dev
# → http://localhost:3000
```

## Compatibility

| | Range |
|---|---|
| Node | `>=18.18.0` |
| Next.js | `>=13.4.0` — CI runs `^14` and `^15` |
| Runtime | Node and Edge |
| Module formats | dual ESM + CJS |

## Contributing

See [`CLAUDE.md`](./CLAUDE.md) for the day-to-day working agreement (TDD discipline, "fix root causes, never workaround", strict TypeScript, no Node-only APIs in `src/`).

## License

MIT — see [`LICENSE`](./LICENSE).
