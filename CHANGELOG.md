# Changelog

All notable changes to `@poli-page/nextjs` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
