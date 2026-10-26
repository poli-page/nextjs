# Changelog

All notable changes to `@poli-page/nextjs` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Breaking:** `createPoliPageClient()` accepts API keys from any environment (`pp_sandbox_…`, `pp_live_…`, `pp_staging_…`). It no longer throws on a key from an unknown environment: a key that does not match `pp_{environment}_{32 hex characters}` logs one warning per key (showing at most its `pp_{environment}_` part, never the secret) and the client starts anyway, leaving the API to answer `401 INVALID_API_KEY`. A missing or empty key still throws.
- **Breaking:** requires the `@poli-page/sdk` release without template versions. Render inputs no longer take `version`, and the `ProjectModeInput` type re-export is replaced by `RenderInput`.
- Example app: renders `getting-started/welcome` with a `pp_sandbox_…` key and no `version`; its error demo is now `GET /errors/not-found` (template `does-not-exist`, `404 TEMPLATE_NOT_FOUND`). The integration tests run only with a `pp_sandbox_…` key.

### Removed

- **Breaking:** the `InlineModeInput` type re-export, following the SDK's removal of `render.preview()` and inline templates. `documents.preview(id)` with `previewResponse()` / `{ kind: 'preview' }` still serves a stored document's HTML.
- Example app: the `/render/preview` route (including its inline `?html=` branch), its button and its README row; the `/errors/bad-version` route.

### Fixed

- `pdfResponse()` / route handler: the `Content-Disposition` filename is now escaped per RFC 6266 / RFC 9110 (`\` and `"` as quoted-pairs, ASCII fallback included) and stripped of control characters (CR/LF, TAB, DEL, C1), so a filename can no longer break the header or inject parameters.

## [0.1.0] — 2026-05-26

### Added

- `createPoliPageClient()` — memoised factory that reads `POLI_PAGE_API_KEY` (plus optional `POLI_PAGE_BASE_URL` / `POLI_PAGE_TIMEOUT` / `POLI_PAGE_MAX_RETRIES` / `POLI_PAGE_RETRY_DELAY`) from `process.env`. Caches per-`apiKey` for no-arg calls; explicit options bypass the memo. Validates the `pp_(test|live)_` prefix and throws synchronously on missing or malformed keys.
- `createPoliPageRouteHandler()` — App Router route handler factory with a discriminated-union return type (`Uint8Array` / `ArrayBuffer` / `ReadableStream` / `{ kind: 'pdf' | 'stream' | 'preview' | 'redirect' }` / `Response`), automatic error → `Response` mapping for `PoliPageError`, and an `onError` hook for user-owned errors.
- Response helpers — `pdfResponse()`, `previewResponse()`, `documentRedirectResponse()`. RFC 5987 filename encoding for non-ASCII names. Default headers: `Cache-Control: no-store, private`, `X-Content-Type-Options: nosniff`.
- First-class Edge runtime support: `src/` uses only Web standards (`fetch` / `Request` / `Response` / `ReadableStream` / `TextEncoder`). Enforced at lint time (`no-restricted-imports` blocks `node:*`, `Buffer`) and verified at test time under `@edge-runtime/vm`.
- Vitest project layout — `unit`, `integration-node`, `integration-edge` — with `tests/setup.ts` snapshotting `process.listeners('unhandledRejection' | 'uncaughtException')` per the symfony-bundle pattern to catch leaks.
- Example Next 15 App Router app under `example-app/` covering all 10 SDK demo steps with route handlers + a standalone CLI script, and an interactive dashboard at `/` that mirrors the symfony-bundle's demo UI (same Manrope / IBM Plex Sans / JetBrains Mono aesthetic, same brand `#4f5d99`).
- Public surface frozen at five named exports plus matching option types and curated SDK type re-exports; an `index.test.ts` asserts no accidental surface widening.

[Unreleased]: https://github.com/poli-page/nextjs/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/poli-page/nextjs/releases/tag/v0.1.0
