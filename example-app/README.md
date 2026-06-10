# example-app — `@poli-page/nextjs` interactive demo

A self-contained Next 15 App Router app that exercises every public surface of `@poli-page/nextjs` against the live develop API. Includes an interactive dashboard at `/` (one button per SDK feature, document lifecycle state machine, inline PDF / HTML previews) and a standalone CLI script for offline rendering.

## Prerequisites

A Poli Page test API key. Put it in `.env` at the **parent repo root** (`../.env`):

```bash
# /Users/.../nextjs/.env
POLI_PAGE_API_KEY=pp_test_…
```

`next.config.ts` loads that file automatically and falls back to a per-app `./.env` if you prefer. Real shell exports always win.

## Setup

```bash
cd example-app
npm install
```

> **Note**: while `@poli-page/sdk` 1.0.0 and `@poli-page/nextjs` are unpublished, the install resolves via `npm link`. From the parent repo: `npm link` (registers the local nextjs package globally), then from this directory: `npm link @poli-page/nextjs @poli-page/sdk`.

## Run

```bash
npm run dev               # → http://localhost:3000
```

The dashboard at `/` walks through every SDK feature. Click each button — the result panel shows the response inline (PDF in an iframe, JSON pretty-printed, HTML preview srcdoc-mounted).

## Routes

| Route | SDK demo step | What it returns |
|---|---|---|
| `GET /render/pdf` | 1. `render.pdf` | `application/pdf`, inline disposition |
| `GET /render/stream` | 2. `render.pdfStream` | streamed `application/pdf` |
| `GET /render/preview` | 4. `render.preview` | paginated HTML preview |
| `POST /documents` | 5. `render.document` | `DocumentDescriptor` JSON |
| `GET /documents/[id]` | 6. `documents.get` | 302 → presigned S3 URL |
| `GET /documents/[id]/thumbnails` | 7. `documents.thumbnails` | `Thumbnail[]` JSON |
| `GET /documents/[id]/preview` | 8. `documents.preview` | stored doc's HTML preview |
| `DELETE /documents/[id]` | 9. `documents.delete` | 204 |
| `GET /errors/bad-version` | 10. error mapping | 400 `{ code: 'INVALID_VERSION_FORMAT', … }` |

## CLI script (SDK demo step 3)

```bash
npm run render-to-file    # writes /tmp/poli-page-demo-file.pdf
```

Runs the standalone `scripts/render-to-file.ts` via `tsx`. Demonstrates calling the SDK outside Next entirely.

## Architecture

- Every route is a one-liner: `export const GET = createPoliPageRouteHandler(async ({ client, params }) => …)`. The factory builds the SDK client from `process.env`, materialises the discriminated-union return into a `Response`, and maps any thrown `PoliPageError` to typed JSON.
- The dashboard at `/` is a single Client Component (`app/page.tsx`) with inline CSS — same aesthetic and state machine as the [`symfony-bundle`](https://github.com/poli-page/symfony-bundle) demo so the two integrations feel like one product.
- `next.config.ts` shims env loading from the parent repo's `.env` if present (workspace pattern; no per-app `.env.local` needed).
