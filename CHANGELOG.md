# Changelog

All notable changes to `@poli-page/nextjs` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.11.0] - 2026-10-30

First published release. It requires `@poli-page/sdk` `^0.11.0`, hence the version number. The `0.1.0` section that used to sit here was never released; its entries are merged below, and the **Breaking** markers describe changes against that unreleased code.

### Added

- `createPoliPageClient()`: memoised factory that reads `POLI_PAGE_API_KEY` (plus optional `POLI_PAGE_BASE_URL` / `POLI_PAGE_TIMEOUT` / `POLI_PAGE_MAX_RETRIES` / `POLI_PAGE_RETRY_DELAY`) from `process.env`. Explicit options bypass the memo. Throws synchronously on a missing or empty key (key format under Changed).
- `createPoliPageRouteHandler()`: App Router route handler factory with a discriminated-union return type (`Uint8Array` / `ArrayBuffer` / `ReadableStream` / `{ kind: 'pdf' | 'stream' | 'preview' | 'redirect' }` / `Response`), automatic error → `Response` mapping for `PoliPageError` (under Changed), and an `onError` hook for user-owned errors.
- `createPoliPageRouteHandler(handler, { handleErrors: false })` turns off the default `PoliPageError` handling for a route: the error is rethrown to Next.js.
- Response helpers: `pdfResponse()`, `previewResponse()`, `documentRedirectResponse()`. RFC 5987 filename encoding for non-ASCII names. Default headers: `Cache-Control: no-store, private`, `X-Content-Type-Options: nosniff`.
- First-class Edge runtime support: `src/` uses only Web standards (`fetch` / `Request` / `Response` / `ReadableStream` / `TextEncoder`). Enforced at lint time (`no-restricted-imports` blocks `node:*`, `Buffer`) and verified at test time under `@edge-runtime/vm`.
- Vitest project layout (`unit`, `integration-node`, `integration-edge`) with `tests/setup.ts` snapshotting `process.listeners('unhandledRejection' | 'uncaughtException')` to catch leaks.
- Example Next 15 App Router app under `example-app/` covering the SDK surface with route handlers and a standalone CLI script, and an interactive dashboard at `/`.
- Public surface frozen at five named exports plus matching option types and curated SDK type re-exports; an `index.test.ts` asserts no accidental surface widening.
- Contract tests: CI runs the integration cases of the Poli Page API contract (v1.3.0) against the example app, built and served by a Next.js production server.
- Release workflow: pushing a `vX.Y.Z` tag runs the checks, then publishes to npm with provenance (OIDC Trusted Publishing) after approval on the `npm-publish` environment, and creates the GitHub Release.

### Changed

- **Breaking:** `createPoliPageClient()` accepts API keys from any environment (`pp_sandbox_…`, `pp_live_…`, `pp_staging_…`). It no longer throws on a key from an unknown environment (it used to accept only `pp_test_` / `pp_live_`): a key that does not match `pp_{environment}_{32 hex characters}` logs one warning per key (naming the expected format, showing no part of the key, not even its `pp_{environment}_` prefix) and the client starts anyway, leaving the API to answer `401 INVALID_API_KEY`. A missing or empty key still throws.
- **Breaking:** requires `@poli-page/sdk` `^0.11.0`, the first SDK release with environment keys and no template versions. Render inputs no longer take `version`, and the `ProjectModeInput` type re-export is replaced by `RenderInput`.
- **Breaking:** the route handler answers a `PoliPageError` with the SDK's `toPayload()` as is: `{ code, message, status, requestId }`, `Content-Type: application/json` (no `charset` parameter), and the payload's `status` as the HTTP status: the API's status, `503` for `network_error`, `504` for `timeout`, or `500` for an SDK error with no status, whose body now keeps `status: null` (it said `500`).
- Example app: depends on this repository's package (`file:..`) and commits its lockfile; renders `getting-started/welcome` with a `pp_sandbox_…` key and no `version`; its error demo is now `GET /errors/not-found` (template `does-not-exist`, `404 TEMPLATE_NOT_FOUND`). The integration tests run only with a `pp_sandbox_…` key.

### Removed

- **Breaking:** the `InlineModeInput` type re-export, following the SDK's removal of `render.preview()` and inline templates. `documents.preview(id)` with `previewResponse()` / `{ kind: 'preview' }` still serves a stored document's HTML.
- Example app: the `/render/preview` route (including its inline `?html=` branch), its button and its README row; the `/errors/bad-version` route.

### Fixed

- Route handler: a stream result (`{ kind: 'stream' }`, a bare `ReadableStream`) is read up to its first chunk before the `Response` is built, so a `PoliPageError` the stream raises before any byte (e.g. `DOWNLOAD_FAILED` from `render.pdfStream()`) is answered with its `toPayload()` JSON instead of a dropped connection. An error after the first chunk still aborts the response.
- `createPoliPageClient()` (no arguments) memoised its client by API key only, so a changed `POLI_PAGE_BASE_URL`, `POLI_PAGE_TIMEOUT`, `POLI_PAGE_MAX_RETRIES` or `POLI_PAGE_RETRY_DELAY` kept the client built from the old values. It now keeps one client, rebuilt when any of them changes.
- `pdfResponse()` / route handler: the `Content-Disposition` filename is now escaped per RFC 6266 / RFC 9110 (`\` and `"` as quoted-pairs, ASCII fallback included) and stripped of control characters (CR/LF, TAB, DEL, C1), so a filename can no longer break the header or inject parameters.
- README: the Node.js requirement is `>=20.18.0`, as `engines` says.
- Package `exports`: `require` now resolves the CommonJS type declarations (`dist/index.d.cts`). It resolved the ESM ones, so TypeScript with `node16` / `nodenext` module resolution typed a CommonJS consumer's import as ESM-only.

[Unreleased]: https://github.com/poli-page/nextjs/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/poli-page/nextjs/releases/tag/v0.11.0
