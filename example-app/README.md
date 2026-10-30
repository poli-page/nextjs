# example-app — `@poli-page/nextjs` interactive demo

A self-contained Next 15 App Router app that exercises every public surface of `@poli-page/nextjs` against the live develop API. Includes an interactive dashboard at `/` (one button per SDK feature, document lifecycle state machine, inline PDF / HTML previews) and a standalone CLI script for offline rendering.

## Prerequisites

A Poli Page sandbox API key (`pp_sandbox_…`). Put it in `.env` at the **parent repo root** (`../.env`); `POLI_PAGE_BASE_URL` is optional:

```bash
# ../.env
POLI_PAGE_API_KEY=pp_sandbox_…
# POLI_PAGE_BASE_URL=https://api.poli.page
```

The demo renders the `getting-started` project's `welcome` template, which every organization has in its `sandbox` environment. `next.config.ts` loads that file automatically and falls back to a per-app `./.env` if you prefer. Real shell exports always win.

## Setup

The app depends on the package in the parent directory (`"@poli-page/nextjs": "file:.."`) and on `@poli-page/sdk` `^0.11.0` from npm. Build the package first, then install the app:

```bash
(cd .. && npm install && npm run build)
npm install
```

## Run

```bash
npm run dev               # → http://localhost:3000
```

The dashboard at `/` walks through every SDK feature. Click each button — the result panel shows the response inline (PDF in an iframe, JSON pretty-printed, a stored document's HTML preview srcdoc-mounted).

## Routes

| Route | SDK demo step | What it returns |
|---|---|---|
| `GET /render/pdf` | 1. `render.pdf` | `application/pdf`, inline disposition |
| `GET /render/stream` | 2. `render.pdfStream` | streamed `application/pdf` |
| `POST /documents` | 4. `render.document` | `DocumentDescriptor` JSON |
| `GET /documents/[id]` | 5. `documents.get` | 302 → presigned S3 URL |
| `GET /documents/[id]/thumbnails` | 6. `documents.thumbnails` | `Thumbnail[]` JSON |
| `GET /documents/[id]/preview` | 7. `documents.preview` | stored doc's HTML preview |
| `DELETE /documents/[id]` | 8. `documents.delete` | 204 |
| `GET /errors/not-found` | 9. error mapping | 404 `{ code: 'TEMPLATE_NOT_FOUND', status, message, requestId }` (renders template `does-not-exist`) |

## CLI script (SDK demo step 3)

```bash
npm run render-to-file    # writes /tmp/poli-page-demo-file.pdf
```

Runs the standalone `scripts/render-to-file.ts` via `tsx`. Demonstrates calling the SDK outside Next entirely.

## Architecture

- Every route is a one-liner: `export const GET = createPoliPageRouteHandler(async ({ client, params }) => …)`. The factory builds the SDK client from `process.env`, materialises the discriminated-union return into a `Response`, and answers any thrown `PoliPageError` with its `toPayload()` JSON body (`{ code, message, status, requestId }`).
- The dashboard at `/` is a single Client Component (`app/page.tsx`) with inline CSS — same aesthetic and state machine as the [`symfony-bundle`](https://github.com/poli-page/symfony-bundle) demo so the two integrations feel like one product.
- `next.config.ts` shims env loading from the parent repo's `.env` if present (workspace pattern; no per-app `.env.local` needed).
