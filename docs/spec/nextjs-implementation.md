# `@poli-page/nextjs` — implementation specification

> Source of truth for what we build, in what shape, and explicitly what we don't. Mirrors `symfony-bundle/docs/spec/bundle-specification.md` so reviewers can cross-reference. Read `INTEGRATIONS_PLAN.md` first; this is the per-repo expansion of the Next.js slot.

**Roadmap slot**: P0.2.
**Target**: ship v0.1.0 as a working npm package, not a recipe.
**Stance**: thin idiomatic Next.js veneer over `@poli-page/sdk`. Anything the SDK already does — HTTP, retries, error classification, idempotency, PSR shims (its Node equivalents) — does NOT get reimplemented here.

---

## 1. What this package is, and what it isn't

### Is
- A Next.js–native wrapper around `@poli-page/sdk` that gives App Router users:
  - A memoised `createPoliPageClient()` reading from `process.env` by default.
  - A `createPoliPageRouteHandler()` that takes a render-returning function and produces a fully-formed `GET`/`POST` App Router handler with correct headers, error→Response mapping, and streaming support.
  - Three response helpers (`pdfResponse`, `previewResponse`, `documentRedirectResponse`) for users who want to keep their own handler signature.
  - First-class Edge runtime support (tested in CI).
  - A small example app at `example-app/` with the same interactive demo-UI pattern shipped in `symfony-bundle`.

### Isn't
- A Pages Router compatibility layer. Pages Router is in maintenance mode upstream (Next 15 doesn't deprecate it but no new sugar lands). Users on Pages Router can either upgrade or call `@poli-page/sdk` directly — the response-helper functions are still usable in `NextApiResponse` handlers if needed, just without the `Response` wrapping. We don't add a `withPoliPage()` HOC for Pages — that's recipe-tier.
- A Server Component. We document the pattern (a RSC can `await client.render.pdf(...)` and stream to the client via a Server Action or pass a presigned URL to a Client Component), but we don't ship a `<PoliPagePDF />` component. Reasons: ties us to UI decisions, adds a React peer dep we don't otherwise need, and the SDK call is already a one-liner inside any `async function Page()`.
- A re-implementation of SDK behaviour. Tests do not cover transport, retries, 4xx mapping, idempotency, or stream chunking — `@poli-page/sdk`'s test suite owns those.
- A Next.js plugin (`next.config.js` integration). Users compose the SDK in route handlers; no compile-time hook is needed.

---

## 2. Required reading (concrete file paths)

Before touching code, read in this order:

1. `/Users/mickael/Projects/INTEGRATIONS_PLAN.md` — cross-repo plan, scope verdicts, cross-cutting DX patterns (§"Cross-cutting DX patterns" is the most relevant section).
2. `/Users/mickael/Projects/symfony-bundle/CLAUDE.md` §10 "Known gotchas" — five battle-tested lessons; most carry to Next.js (CLI option reservations are the obvious exception).
3. `/Users/mickael/Projects/symfony-bundle/docs/spec/bundle-specification.md` — reference shape; this doc deliberately mirrors its section numbering where the concept transfers.
4. `/Users/mickael/Projects/sdk-node/README.md` and `dist/index.d.ts` (or the regenerated types) — the SDK surface we're wrapping.
5. `/Users/mickael/Projects/symfony-bundle/example-app/templates/demo.html` + `DemoController.php` — reference interactive-demo UI we replicate in the Next example app.
6. Next.js App Router docs on Route Handlers, Edge runtime, and Streaming: <https://nextjs.org/docs/app/building-your-application/routing/route-handlers>.

---

## 3. Version targets

| Field | Value |
|---|---|
| Package name | `@poli-page/nextjs` |
| Initial version | `0.1.0` |
| Node | `>=18.18.0` (Next 14+ minimum) |
| Next.js | `>=13.4.0` (App Router GA) tested against `^14`, `^15` |
| TypeScript | `>=5.0` (peer-optional; types ship pre-compiled) |
| React | peer `>=18` (only declared because some users will resolve through us) |
| Module formats | dual ESM + CJS, `exports` map with `types` first |
| Runtime support | Node runtime (default) and Edge runtime, both tested |

`@poli-page/sdk` is pinned as a regular dependency at `^1.0.0` (already on npm — no local-link workaround needed for the long term; see §12 for dev-time only).

---

## 4. Architecture style

Functional, no classes, no DI. Three primitives:

1. **`createPoliPageClient(options?)`** — factory that builds and memoises a `PoliPage` instance.
2. **`createPoliPageRouteHandler(handler, options?)`** — higher-order function that turns a render function into a Next.js route export.
3. **Response helpers** — pure functions: `(input, options) => Response`.

That's the whole API surface. No middleware to register, no provider to wrap children in, no `next.config.js` plugin, no CLI.

The package is **tree-shakeable**: each export lives in its own file with no cross-import side effects, so unused helpers drop in production bundles.

---

## 5. File layout

```
nextjs/
├── src/
│   ├── index.ts                      # re-exports the public API (3 functions + types)
│   ├── client.ts                     # createPoliPageClient() + memo
│   ├── routeHandler.ts               # createPoliPageRouteHandler()
│   ├── responses/
│   │   ├── pdfResponse.ts
│   │   ├── previewResponse.ts
│   │   └── documentRedirectResponse.ts
│   ├── headers.ts                    # internal: filename encoding, Cache-Control, etc.
│   └── errors.ts                     # internal: PoliPageError → Response mapping
├── tests/
│   ├── unit/
│   │   ├── client.test.ts
│   │   ├── routeHandler.test.ts
│   │   ├── responses/
│   │   │   ├── pdfResponse.test.ts
│   │   │   ├── previewResponse.test.ts
│   │   │   └── documentRedirectResponse.test.ts
│   │   ├── headers.test.ts
│   │   └── errors.test.ts
│   ├── integration/
│   │   ├── renderAgainstDevelopApi.node.test.ts    # runs in Node runtime
│   │   └── renderAgainstDevelopApi.edge.test.ts    # runs in Edge / @miniflare style
│   ├── setup.ts                      # loads repo-root .env
│   └── tsconfig.json
├── example-app/                      # Next 15 demo app — see §13
├── docs/
│   ├── spec/nextjs-implementation.md       # this file
│   └── plan/YYYY-MM-DD-implementation.md   # written separately, after spec sign-off
├── tsup.config.ts                    # build config (dual ESM/CJS)
├── vitest.config.ts                  # test runner config + edge test project
├── tsconfig.json
├── package.json
├── README.md
├── CHANGELOG.md
├── CLAUDE.md                         # integration-flavored (replaces inherited SDK template)
├── LICENSE                           # MIT (same as bundle)
└── .gitignore
```

**File count**: 6 source files, 8 test files (matching 1:1), one build config, one test config. Everything else is metadata. Adding files beyond this list requires editing §15 first.

---

## 6. Environment & configuration

### 6.1 Convention

Single env var read by default:

```
POLI_PAGE_API_KEY=pp_test_…
```

Optional overrides:

```
POLI_PAGE_BASE_URL=https://api-develop.poli.page
POLI_PAGE_TIMEOUT=30000          # ms
POLI_PAGE_MAX_RETRIES=3
POLI_PAGE_RETRY_DELAY=500        # ms
```

Names match Symfony's where they overlap (`API_KEY`, `BASE_URL`, `TIMEOUT`); the retry knobs use the SDK's own field names (`maxRetries`, `retryDelay`) flattened with the `POLI_PAGE_` prefix.

### 6.2 Override hierarchy

1. Explicit `options` passed to `createPoliPageClient({ ... })`.
2. `process.env.POLI_PAGE_*`.
3. SDK defaults (apply when neither is set).

No `.env.local`-style file loading is done inside the package. Next.js already loads `.env` / `.env.local` / `.env.production` before user code runs; we just read `process.env`. The example app uses the same "single root `.env`" pattern documented in `INTEGRATIONS_PLAN.md` §2 — its `next.config.ts` shims a load of the bundle workspace's root `.env` if present, falling back to the per-app file.

### 6.3 Validation

`createPoliPageClient()` throws synchronously when `apiKey` is missing or doesn't match the `pp_test_*` / `pp_live_*` shape. Same regex the bundle uses. Throwing during route-handler factory invocation surfaces the error at module load → catchable by Next's error overlay in dev, fails the build in static export.

---

## 7. Public API

### 7.1 `createPoliPageClient(options?)`

```ts
import { createPoliPageClient } from '@poli-page/nextjs'
import type { PoliPage, PoliPageClientOptions } from '@poli-page/nextjs'

export function createPoliPageClient(options?: PoliPageClientOptions): PoliPage

// Mirrors @poli-page/sdk's PoliPageOptions exactly, except apiKey is
// optional here (we fall back to process.env.POLI_PAGE_API_KEY).
interface PoliPageClientOptions {
  apiKey?: string                     // default: process.env.POLI_PAGE_API_KEY
  baseUrl?: string                    // default: process.env.POLI_PAGE_BASE_URL
  maxRetries?: number                 // default: process.env.POLI_PAGE_MAX_RETRIES, then SDK default
  retryDelay?: number                 // ms; default: process.env.POLI_PAGE_RETRY_DELAY, then SDK default
  timeout?: number                    // ms; default: process.env.POLI_PAGE_TIMEOUT, then SDK default
  onRequest?: (e: RequestEvent) => void
  onResponse?: (e: ResponseEvent) => void
  onRetry?: (e: RetryEvent) => void
  onError?: (err: PoliPageError) => void
}
```

**Memoisation**: when called with no arguments, the result is cached at module scope keyed by `apiKey`. Two `createPoliPageClient()` calls in the same process return the same instance. Calls with explicit options bypass the cache (caller owns the lifecycle).

The memo is **per-runtime**: in Edge runtime each request can be a new isolate, so the memo is effectively per-isolate. Documented in §8.

### 7.2 `createPoliPageRouteHandler(handler, options?)`

```ts
import { createPoliPageRouteHandler } from '@poli-page/nextjs'
import type {
  RouteHandlerContext,
  RouteHandlerOptions,
} from '@poli-page/nextjs'

export function createPoliPageRouteHandler<TParams = Record<string, string>>(
  handler: (ctx: RouteHandlerContext<TParams>) => Promise<RouteHandlerResult>,
  options?: RouteHandlerOptions,
): (req: NextRequest, ctx: { params: Promise<TParams> }) => Promise<Response>

interface RouteHandlerContext<TParams> {
  req: NextRequest
  params: TParams
  client: PoliPage
}

type RouteHandlerResult =
  | Uint8Array | ArrayBuffer                              // → pdfResponse
  | ReadableStream                                         // → pdfResponse (streamed)
  | { kind: 'pdf'; bytes: Uint8Array | ArrayBuffer; filename?: string; inline?: boolean }
  | { kind: 'stream'; stream: ReadableStream; filename?: string; inline?: boolean }
  | { kind: 'preview'; html: string }
  | { kind: 'redirect'; url: string }
  | Response                                               // user returns their own

interface RouteHandlerOptions {
  client?: PoliPage                    // skip the memoised default
  filename?: (ctx: RouteHandlerContext<unknown>) => string
  cache?: 'no-store' | 'private' | string  // overrides default Cache-Control
  onError?: (err: unknown, ctx: RouteHandlerContext<unknown>) => Response | void
}
```

The handler returns the rendered output; the wrapper does the `Response` construction. The discriminated-union form (`{ kind: 'pdf', ... }`) is the documented happy path; the bare `Uint8Array` form is a shortcut for "just stream this PDF with sensible defaults".

**Errors**: any thrown `PoliPageError` is mapped to a JSON `Response`:

| SDK error status | HTTP response status | Body |
|---|---|---|
| 4xx | same | `{ code, message, requestId }` |
| 5xx | same | `{ code, message, requestId }` |
| network/timeout | 502 | `{ code: 'NETWORK_ERROR', message, requestId: null }` |

Non-`PoliPageError` throws bubble up to Next's error boundary unchanged.

The `Cache-Control: no-store, private` default prevents Next's full-route cache from caching PDFs by accident.

### 7.3 Response helpers

```ts
import { pdfResponse, previewResponse, documentRedirectResponse } from '@poli-page/nextjs'

export function pdfResponse(
  body: Uint8Array | ArrayBuffer | ReadableStream,
  options?: { filename?: string; inline?: boolean; cacheControl?: string },
): Response

export function previewResponse(
  html: string,
  options?: { cacheControl?: string },
): Response

export function documentRedirectResponse(
  presignedUrl: string,
  options?: { permanent?: boolean },     // 308 if true, default 302
): Response
```

Headers each helper sets:

| Helper | Content-Type | Content-Disposition | Cache-Control | X-Content-Type-Options |
|---|---|---|---|---|
| `pdfResponse` | `application/pdf` | `attachment; filename*=UTF-8''<rfc5987>` (or `inline` when `inline: true`) | `no-store, private` (override via opt) | `nosniff` |
| `previewResponse` | `text/html; charset=utf-8` | — | `no-store, private` | `nosniff` |
| `documentRedirectResponse` | — | — | `no-store, private` | — |

Filename encoding follows RFC 5987 with both `filename=` (ASCII fallback) and `filename*=UTF-8''` (encoded) — same logic as `PoliPageResponseFactory` in the bundle, ported. See §11.

---

## 8. Runtime support matrix

### 8.1 Node runtime (default)

All exports work. `createPoliPageClient()` uses Node's `globalThis.fetch` (Node 18+). Memoisation is process-wide.

### 8.2 Edge runtime

To opt into Edge, the user adds to their route file:

```ts
export const runtime = 'edge'
```

All `@poli-page/nextjs` exports work under Edge because they only touch:
- `globalThis.fetch` (Web standard)
- `Request` / `Response` / `Headers` (Web standard)
- `ReadableStream` / `TransformStream` (Web Streams API)
- `TextEncoder` / `TextDecoder` (Web standard)

What we explicitly do NOT use anywhere in the package:
- `Buffer` (Node-only)
- `fs` / `path` / `process.nextTick`
- `stream` (the Node module — Web Streams are fine)
- Any `node:` import

Verified by:
- ESLint rule `no-restricted-imports` blocking the list above (configured in `.eslintrc`).
- The `tsup` build emits an `edge` conditional export pointing at the same files; if it diverges in the future, the divergence is enforced.
- One integration test runs under the Edge runtime via the `@edge-runtime/vm` adapter in Vitest.

### 8.3 Caveats

- Memoisation in Edge is per-isolate, not per-process. Cold-start cost is one `createPoliPageClient()` invocation per isolate; SDK is small so this is sub-ms.
- `process.env` is available in Edge for Next-prefixed and explicitly exposed vars. `POLI_PAGE_API_KEY` is unprefixed but server-only; Next exposes all server env to Edge route handlers. Documented.

---

## 9. Streaming behavior

### 9.1 PDF streaming

Two paths:

**Buffered**: `client.render.pdf(...)` returns `Uint8Array`. Passed to `pdfResponse(bytes)` → fully materialised in memory. Default.

**Streamed**: `client.render.pdfStream(...)` returns `ReadableStream<Uint8Array>`. Passed to `pdfResponse(stream)` → chunks flow directly to the client. Memory cost is bounded; first-byte latency drops.

Both work in Node and Edge runtimes. Backpressure is honoured by piping through `Response`'s native stream consumer.

### 9.2 Document redirects

`client.documents.get(id)` returns a descriptor with a presigned S3 URL. `documentRedirectResponse(url)` issues a 302 with `Cache-Control: no-store, private` (we don't want intermediaries caching the presigned URL).

### 9.3 No internal buffering

The package does NOT introduce additional buffering between the SDK and the `Response` body. If the SDK returns a stream, we pipe it. If it returns bytes, we hand the bytes to `new Response(bytes, ...)`. This keeps Edge-runtime memory limits respected.

---

## 10. Error handling

The bundle catches `PoliPageError` and maps to a typed JSON response. We do the same.

```ts
// src/errors.ts
export function poliPageErrorToResponse(err: PoliPageError): Response {
  const status =
    err.status && err.status >= 400 && err.status < 600
      ? err.status
      : 502  // network/timeout/unknown
  return new Response(
    JSON.stringify({
      code: err.code ?? 'UNKNOWN',
      message: err.message,
      requestId: err.requestId ?? null,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, private',
      },
    },
  )
}
```

Only `PoliPageError` is mapped; any other throw bubbles up to Next's `error.tsx` boundary. Documented as a rule in the README.

**No exception swallowing**: route handlers DO NOT log errors themselves. Logging is the user's responsibility (via Next's instrumentation API or their preferred observability stack).

---

## 11. Header utilities (`src/headers.ts`)

Internal, not exported.

```ts
export function contentDisposition(filename: string, inline: boolean): string
export function isAsciiSafe(s: string): boolean
export function rfc5987Encode(s: string): string
```

Behavior:
- If `filename` is ASCII-safe: `attachment; filename="<escaped>"`.
- Otherwise: `attachment; filename="<ascii-fallback>"; filename*=UTF-8''<rfc5987>`.
- `inline: true` swaps `attachment` for `inline`.

ASCII fallback: replace non-ASCII chars with `_`. Same algorithm as the bundle's `PoliPageResponseFactory`, ported character-for-character — the bundle's unit tests for this are the canonical reference.

---

## 12. Unpublished-SDK workaround (dev only)

`sdk-node` is already published (`@poli-page/sdk` v1.0.0 on npm), so this section is mostly precautionary. During active dev where we want to test against unreleased SDK changes, npm has a clean primitive: **npm workspaces** (sdk-node already uses npm, not pnpm/yarn — confirmed by its `package-lock.json`).

### 12.1 Solution

Repository root (`/Users/mickael/Projects/`) gets a top-level `package.json` declaring `sdk-node`, `nextjs`, and other Node integrations under `"workspaces": [...]`. The `@poli-page/sdk` dep in `nextjs/package.json` stays as `"^1.0.0"` — published-compatible. During dev `npm install` at the workspace root resolves `@poli-page/sdk` to the local checkout; published consumers (and CI when not testing against unreleased SDK changes) resolve from npm.

Fallback when the workspace root isn't set up: `npm link ../sdk-node` (documented in `CLAUDE.md`). Either way, **no changes to the published manifest**.

### 12.2 What changes when we're ready to publish

Nothing. The integration's `package.json` is already correct. Just `npm publish` after running the build.

### 12.3 CI handling

CI installs from the workspace (faster, no registry round-trip). The CI workflow has a single matrix axis (Node 18 / 20 / 22) × runtime (`node` / `edge`).

---

## 13. Example app

`example-app/` is a self-contained Next 15 App Router project that mirrors the symfony-bundle's example-app feature-for-feature.

### 13.1 Routes (App Router conventions)

| SDK demo step | Route | Implementation |
|---|---|---|
| 1. `render.pdf` | `app/render/pdf/route.ts` (GET) | `createPoliPageRouteHandler(({ client }) => client.render.pdf({...}))` |
| 2. `render.pdfStream` | `app/render/stream/route.ts` (GET) | Same but `pdfStream` and returns `{ kind: 'stream', stream }` |
| 3. `renderToFile` | `app/api/cli/render-to-file/route.ts` (POST) — or a `scripts/render-to-file.ts` standalone? **Decide in §13.4.** | — |
| 4. `render.preview` | `app/render/preview/route.ts` (GET) | Returns `{ kind: 'preview', html }` |
| 5. `documents.create` | `app/documents/route.ts` (POST) | Returns descriptor JSON via standard `Response` |
| 6. `documents.get` | `app/documents/[id]/route.ts` (GET) | Returns `{ kind: 'redirect', url }` |
| 7. `documents.thumbnails` | `app/documents/[id]/thumbnails/route.ts` (GET) | JSON |
| 8. `documents.preview` | `app/documents/[id]/preview/route.ts` (GET) | Returns `{ kind: 'preview', html }` |
| 9. `documents.delete` | `app/documents/[id]/route.ts` (DELETE) | 204 |
| 10. Error handling | `app/errors/bad-version/route.ts` (GET) | Throws `INVALID_VERSION_FORMAT`; handler maps to JSON response |

### 13.2 Interactive demo UI

`app/page.tsx` ships the **same** interactive dashboard pattern as the symfony-bundle's `templates/demo.html` — one button per SDK feature, inline `<iframe>` PDF previews, document-lifecycle state machine in client state, JSON pretty-print for error / thumbnails / delete responses.

Aesthetic copied from the bundle's redesign (white surface, muted indigo `#4f5d99`, Manrope display sans + IBM Plex Sans body + JetBrains Mono code). Implemented as a single Client Component file (`'use client'`), no Tailwind, no CSS-in-JS — just a `<style>` block scoped at the top, exactly matching the bundle's pattern. Reusing the same styles across integrations is intentional brand consistency.

### 13.3 Server Component example

`app/server-pdf/page.tsx` demonstrates the documented Server-Component pattern: a Server Component awaits `client.render.pdf(...)`, base64-encodes the result, and renders an `<iframe src="data:application/pdf;base64,...">`. This is the de-facto "how do I render a PDF inline from a Server Component" answer — it lives in the demo so users can copy it.

### 13.4 CLI script (SDK demo step 3)

`scripts/render-to-file.ts` — a standalone Node script run via `tsx` or `node --import tsx/esm scripts/render-to-file.ts`. Not a route. Demonstrates calling the SDK outside Next.js entirely, then writing to disk. Matches the bundle's `app:demo:render-to-file` command in spirit.

### 13.5 Env loading

`example-app/next.config.ts` includes a small preamble that reads `../.env` (the bundle/workspace root) if present, pushing values into `process.env` only when not already set. Same precedence rules as the bundle's `tests/bootstrap.php`: real env wins. Pattern documented in `INTEGRATIONS_PLAN.md` §2.

### 13.6 Running it

```bash
cd example-app
npm install
npm run dev                           # → http://localhost:3000
```

No per-app `.env.local` needed. Hard requirement (carried from the bundle, per `INTEGRATIONS_PLAN.md` §"Cross-cutting DX patterns" §2).

---

## 14. Testing strategy

### 14.1 Tooling

- **Runner**: Vitest (modern, ESM-native, fast). Configured with two projects: `node` and `edge` (via `@edge-runtime/vm`).
- **Mocks**: `msw` for HTTP mocking in unit tests where we need to assert request shape, but ONLY for tests that genuinely benefit — we don't re-test the SDK's transport. Most unit tests mock the SDK client directly (`vi.mock('@poli-page/sdk')`).
- **TypeScript**: tests are `.ts` with the same `tsconfig` strictness as `src/`.

### 14.2 What to test (integration-specific)

- `createPoliPageClient()` reads env correctly, memoisation works, throws on missing key, throws on bad-format key.
- `createPoliPageRouteHandler()` produces a function whose return value, given a mock client, has the right status / Content-Type / Content-Disposition / Cache-Control headers for each result-kind.
- Response helpers set the documented headers; non-ASCII filenames RFC-5987 encode correctly.
- `PoliPageError` → `Response` mapping covers 4xx, 5xx, network. Non-`PoliPageError` throws bubble (do not get mapped).
- Edge integration test: import all three helpers + the factory in an Edge-runtime test file and call them with a mock SDK. Asserts no `Buffer`/`Node API` calls leaked.
- Real-API integration test: ONE happy-path test against `https://api-develop.poli.page` rendering `getting-started/welcome`. Skipped if `POLI_PAGE_API_KEY` is unset.

### 14.3 What NOT to test (the SDK already does)

- HTTP transport behavior (Undici / fetch edge cases).
- Retry policy (backoff, max attempts, never-retry-4xx, `Retry-After`).
- 4xx / 5xx → `PoliPageError` mapping in the SDK.
- Idempotency-Key generation.
- Stream chunking correctness.
- API contract drift — the SDK's contract tests cover that.

### 14.4 Test runner hygiene

Per `symfony-bundle/CLAUDE.md` §10.1 (PHPUnit risky-handler-leak gotcha), strict test runners flag global-state leaks. For Next.js / Vitest, the equivalent hazard is `process.on('unhandledRejection')` listeners leaking between tests. Vitest's `--reporter=verbose` doesn't enforce this by default, but we add a `tests/setup.ts` that snapshots and restores `process.listeners('unhandledRejection')` and `process.listeners('uncaughtException')` per test file. Pattern documented in `INTEGRATIONS_PLAN.md` §4.

### 14.5 Coverage target

- Unit tests cover 100% of the package's branches (it's small enough to be feasible).
- Integration tests are not coverage-counted; their job is "real round-trip works once".

---

## 15. CI

Single workflow `.github/workflows/ci.yml`:

```yaml
matrix:
  node: [18, 20, 22]
  next: [14, 15]
steps:
  - actions/setup-node@v4 with cache: 'npm'
  - npm ci
  - npm run typecheck
  - npm run lint
  - npm test                # Vitest, both runtime projects
  - npm run build           # tsup; verify dist/ shape
```

Each step auto-skips if the relevant config file is missing (same convention as the symfony-bundle CI), so a freshly scaffolded repo is green from day one.

The real-API integration test runs only on `main` after merge, gated on the secret being present.

---

## 16. README content (post-spec, for v0.1.0)

The README ships with:

1. Install + first PDF render (a 10-line snippet using `createPoliPageRouteHandler`).
2. The three primitives, one short example each.
3. Edge runtime support — opt-in via `export const runtime = 'edge'`, no other changes needed.
4. Streaming example (`render.pdfStream` + `{ kind: 'stream' }`).
5. Server Component pattern (4-line example, no new API).
6. Error handling — what gets caught (only `PoliPageError`), what doesn't.
7. Pointer to `example-app/` (interactive demo dashboard).

Aim: under 250 lines. The SDK's README is the deep-dive surface; this README is the "how does this look in Next.js specifically" surface.

---

## 17. Out of scope (v0.1.0)

- **Pages Router** — covered in §1.
- **`<PoliPagePDF />` React component** — covered in §1.
- **Server Action helpers** — `createPoliPageAction()` would be nice; deferred to v0.2 if users ask. The pattern is already trivial without it.
- **Middleware integration** — no obvious use case. Skip.
- **Built-in caching strategy** — Next's `revalidate` / `unstable_cache` already cover this; we don't reinvent it.
- **Custom Edge route runtime detection** — if a user puts `export const runtime = 'edge'` in a route using a helper that breaks on Edge, they get a runtime error from Next. We don't add a build-time check.
- **CLI** — Next.js apps invoke `next` and `next dev`; there's no "bundle smoke-test CLI" equivalent because Next has no per-app entry-point command. The example-app's `npm run dev` + the demo UI ARE the smoke test.

---

## 18. Resolved decisions

Captured from the spec-review conversation so future agents don't reopen them:

| Decision | Choice | Why |
|---|---|---|
| Verdict (package vs recipe) | **Full npm package** | INTEGRATIONS_PLAN.md's "borderline" called for a re-decide post-Symfony; package wins because App-Router-route-handler + Edge + streaming are concrete value-adds the SDK alone can't ship idiomatically. |
| Router scope | **App Router only** | Pages Router is legacy; new Next projects all start on App Router. Keeps the API surface small. |
| Workspace tool | **npm workspaces** | `sdk-node` already uses npm (`package-lock.json` present, no pnpm/yarn lockfile). Aligning across the Node monorepo avoids dual-toolchain pain. |
| Test runner | **Vitest** | `sdk-node` uses Vitest (confirmed via its `vitest.config.ts`). Native ESM, TS, and Edge-runtime support via `@edge-runtime/vm`. |
| Build tool | **tsup** | `sdk-node` uses tsup (confirmed via its `tsup.config.ts`). Esbuild-based, dual ESM/CJS, fast. |
| Idempotency-Key bridging | **User-controlled** | No auto-derivation from request signals. Users pass `idempotencyKey` to the SDK call themselves. Revisit only if a common pattern emerges. |
| Client injection in route handler | **Memoised default + override** | `createPoliPageRouteHandler()` builds a default client from env on first call. Users can pass `{ client }` to override. Zero-config for the 80% case. |
| Server Component helper | **Docs only** | No `<PoliPagePDF />` shipped. RSC users `await client.render.pdf(...)` directly and pipe to whichever UI primitive they want. Avoids React peer-dep ownership. |
| Edge runtime support | **First-class, tested** | Both `node` and `edge` Vitest projects run in CI. Sets the package apart from generic Node SDKs. |

---

## 19. Definition of done (v0.1.0)

- All §5 files exist, all §7 exports are typed and tested.
- Edge integration test passes alongside Node integration test.
- Example app runs from `npm install && npm run dev` with no `.env.local` step (single root `.env` consumed).
- Demo UI at `/` exercises all 10 SDK demo steps with the interactive-dashboard pattern.
- README + CHANGELOG match the v0.1.0 row.
- Replacement `CLAUDE.md` (integration-flavored) is in place — drops the SDK-flavored test-everything sections inherited from the template.
- CI matrix green: 6 cells (3 Node versions × 2 Next versions).

This document is the source of truth. If a PR's design conflicts with it, the spec gets updated FIRST in the same PR, with reasoning in the description.
