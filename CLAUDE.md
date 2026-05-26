# CLAUDE.md

> Instructions for Claude Code agents working in `poli-page/nextjs`.

## 1. Repo at a glance

| Field        | Value |
| ------------ | ----- |
| Repository   | `poli-page/nextjs` |
| Type         | Framework integration (Next.js App Router) |
| Language     | TypeScript (ES2022, strict) |
| Node         | `>=18.18.0` |
| Next.js      | `>=13.4.0`; CI matrix covers `^14` and `^15` |
| Registry     | npm — `@poli-page/nextjs` |
| Depends on   | `@poli-page/sdk` (npm, `^1.0.0`) |
| Roadmap slot | P0.2 |

**Source-of-truth docs (read first):**
- `docs/spec/nextjs-implementation.md` — full design spec for v0.1.0
- `docs/plan/YYYY-MM-DD-implementation.md` — implementation plan
- `/Users/mickael/Projects/INTEGRATIONS_PLAN.md` — cross-repo umbrella note, esp. §"Cross-cutting DX patterns"
- `/Users/mickael/Projects/symfony-bundle/CLAUDE.md` §10 "Known gotchas" — five battle-tested lessons; most carry over

## 2. The package's job

This package is a **thin App-Router-flavored wrapper** around the official Poli Page Node SDK (`@poli-page/sdk`, source at `/Users/mickael/Projects/sdk-node/`). It provides:

- `createPoliPageClient()` — memoised client factory reading from `process.env`
- `createPoliPageRouteHandler()` — produces an App Router `GET`/`POST` handler with correct headers, error→Response mapping, and streaming support
- Response helpers: `pdfResponse()`, `previewResponse()`, `documentRedirectResponse()`
- First-class Edge runtime support (no Node-only APIs anywhere in `src/`)
- A small example app at `example-app/` mirroring the symfony-bundle's interactive demo UI

**This package does NOT** reimplement HTTP transport, retries, error classification, idempotency keys, stream chunking, or anything else the SDK already does. Bug in those areas? Fix it in `sdk-node`, not here.

**This package does NOT** ship: a Pages Router compatibility layer, a `<PoliPagePDF />` React component, a `next.config.js` plugin, or a CLI. See `docs/spec/nextjs-implementation.md` §1 for the explicit "isn't" list.

## 3. Working language

- **Code, comments, file names, commit messages, PR descriptions, repository documentation**: English.
- **Day-to-day conversation with Xavier/Mickael**: French, tutoiement.
- **Conversation in this Claude Code session**: French is fine for the chat; artifacts stay English.

## 4. TDD is mandatory

RED → GREEN → refactor for every change. Tests live in `tests/unit/` (mocked SDK, 90%+ of the suite) and `tests/integration/` (one against the develop API, gated on `POLI_PAGE_API_KEY`; runs in both Node and Edge runtimes).

### What to test (integration-specific!)

- **Client factory**: env reading, missing-key throws, bad-prefix throws (`pp_test_*` / `pp_live_*` only), memoisation returns the same instance across no-arg calls, explicit options bypass the memo.
- **Route handler factory**: each result `kind` (`pdf` / `stream` / `preview` / `redirect` / bare `Uint8Array` / `Response`) produces a `Response` with the documented headers; `PoliPageError` throws map to typed JSON responses; non-`PoliPageError` throws bubble.
- **Response helpers**: every method sets the right `Content-Type`, RFC 5987 `Content-Disposition`, `Cache-Control`, `X-Content-Type-Options`. ASCII AND non-ASCII filenames both encode correctly. The bundle's `PoliPageResponseFactory` tests are the canonical reference — port them.
- **Edge runtime**: one integration test imports every public export under `@edge-runtime/vm` and exercises them with a mock SDK. Asserts no `Buffer`, `process.nextTick`, `node:*` use.
- **Error mapping**: `PoliPageError(status=4xx)` → 4xx JSON; `PoliPageError(status=5xx)` → 5xx JSON; network/timeout → 502 with `code: 'NETWORK_ERROR'`.

### What NOT to test (the SDK already does)

- HTTP transport behavior (Undici, fetch edge cases, connection pooling)
- Retry policy (backoff, max attempts, `Retry-After`, never-retry-4xx)
- 4xx / 5xx → `PoliPageError` mapping inside the SDK
- Idempotency-Key generation
- Stream chunking correctness
- API contract drift — the SDK's contract tests own that

Re-testing these here doubles maintenance burden. **If you find yourself writing a mock HTTP server, stop — you're doing the SDK's job.**

## 5. Robustness over shortcuts

Mickael's hard rule (validated in the symfony-bundle session): **no hacks to make a test pass or a corner case go away**. Fix root causes. If a workaround is genuinely required (framework bug, SDK quirk), document it inline with a `// Why:` comment naming the constraint.

Concretely: don't disable strict ESLint/TypeScript rules, don't suppress Vitest risky-test warnings, don't `// @ts-expect-error` away type errors, don't widen types to silence them. The symfony-bundle's `tests/RestoresGlobalHandlers.php` trait is the reference for fixing test-runner strictness the right way.

## 6. Code conventions

- **TypeScript strict mode** + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. Configured in `tsconfig.json`.
- **ESLint flat config** matching `sdk-node`'s. The `no-restricted-imports` rule in `src/` blocks `node:*`, `fs`, `path`, `Buffer`, `stream` — anything that breaks Edge.
- **No commented-out code, no TODO without a linked issue, no debug prints.**
- **Default to no comments.** Add one only when the *why* is non-obvious. Comments restating *what* the code does are noise.
- **No default exports.** Named exports only.
- Public functions use `export function ...` (not `export const ... = () => ...`) so they appear nicely in stack traces and TypeScript intellisense.

## 7. Commits and PRs

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- **One concern per PR**, reviewable in under 30 minutes.
- PR description: what changed, why, how it was tested.
- CI must be green before merge.

## 8. CI

Workflow: `.github/workflows/ci.yml`. Matrix: Node `18`/`20`/`22` × Next.js `14`/`15`. Each step auto-skips if the relevant config is missing (so a freshly scaffolded repo is green from day one).

Local mirror:
```bash
npm ci
npm run typecheck
npm run lint
npm test          # Vitest, both node and edge runtime projects
npm run build     # tsup; verify dist/ shape
```

## 9. Unpublished-SDK / workspace note

`@poli-page/sdk` is **already published** on npm (`^1.0.0`), so for normal dev you just `npm install`. When testing against unreleased SDK changes, use either:

1. **npm workspaces** — declare `sdk-node` and `nextjs` as workspaces under a root `package.json` at `/Users/mickael/Projects/`. `npm install` resolves to the local checkout; nothing changes in this repo's manifest.
2. **`npm link`** (fallback when the workspace root isn't set up):
   ```bash
   cd /Users/mickael/Projects/sdk-node && npm link
   cd /Users/mickael/Projects/nextjs    && npm link @poli-page/sdk
   ```

Either way, the integration's published `package.json` stays clean (`"@poli-page/sdk": "^1.0.0"`).

## 10. Known gotchas (battle-tested — don't relearn the hard way)

These caught us once in `symfony-bundle` or surface from Next.js / Vitest specifics. Recorded so future agents don't burn a session rediscovering them.

### 10.1 Vitest `process` listener leaks

Strict Vitest configs (and our `tests/setup.ts`) flag tests that leave dangling `process.on('unhandledRejection')` or `process.on('uncaughtException')` listeners. Next's runtime instrumentation can register these.

**Fix in place** (carry from symfony-bundle's `RestoresGlobalHandlers` trait, adapted): `tests/setup.ts` snapshots `process.listeners('unhandledRejection')` and `process.listeners('uncaughtException')` at file load, and re-applies that snapshot in `afterEach`. Apply to any test file that loads code which registers process listeners.

**Do NOT** disable the check globally. Same rule as symfony-bundle §10.1.

### 10.2 Nothing in `src/` may import Node-only APIs

`src/` runs on both Node and Edge runtimes. Edge has no `Buffer`, no `node:fs`, no `node:stream`, no `process.nextTick`. The ESLint `no-restricted-imports` rule blocks them at lint time, and one Edge integration test catches anything that slips through.

**Allowed:** `globalThis.fetch`, `Request`, `Response`, `Headers`, `URL`, `ReadableStream`, `TransformStream`, `TextEncoder`, `TextDecoder`, `crypto.subtle`.

**Not allowed in `src/`** (lint-blocked): `Buffer`, `node:*`, `fs`, `path`, `process.nextTick`, anything from `stream` (the Node module — Web Streams are fine), `child_process`, `cluster`, `os`.

Test code (`tests/`) can use Node APIs freely — only `src/` is constrained.

### 10.3 `createPoliPageClient()` memo is per-runtime, not per-process

On Edge, each isolate is potentially a fresh module load, so the memo is effectively per-isolate (not per-process). Cold-start cost is one factory call per isolate. Document this in the README; do NOT try to "fix" it by reaching for a global cache — that's not portable across Edge providers.

### 10.4 Only `PoliPageError` gets mapped to a `Response`

`createPoliPageRouteHandler()` catches `PoliPageError` and turns it into a typed JSON response. **Any other throw bubbles up** to Next's `error.tsx` boundary unchanged. This is intentional — generic exception swallowing destroys observability.

If a user wants custom mapping for their own errors, they pass `options.onError`. Documented behavior, don't expand the catch scope.

### 10.5 Single root `.env`, no per-app `.env.local`

Both `tests/setup.ts` and `example-app/next.config.ts` read the bundle/workspace root `.env`. Real env vars (shell exports) still win.

**Do NOT** introduce a `.env.local` in `example-app/` or instruct users to `cp .env .env.local`. This was an explicit hard requirement from Mickael during the symfony-bundle session. See `INTEGRATIONS_PLAN.md` §"Cross-cutting DX patterns" §2.

### 10.6 No CLI / artisan equivalent

Next.js has no per-app command-line entry point we can attach to (the `next` CLI is the framework's own; the example app's `npm run dev` IS the smoke test). The SDK demo step 3 (`renderToFile`) becomes a standalone Node script in `example-app/scripts/render-to-file.ts`, not a route. Don't try to invent a CLI here.

## 11. When stuck

- Re-read `docs/spec/nextjs-implementation.md` first; most "open questions" are answered there or in §18 "Resolved decisions".
- Compare with `sdk-node` at `/Users/mickael/Projects/sdk-node/`.
- Compare with the symfony-bundle at `/Users/mickael/Projects/symfony-bundle/` — same product, different framework, decisions you can copy directly.
- Look at industry benchmarks: Vercel's own SDK helpers (route handlers + middleware), `@clerk/nextjs` (auth integration), `@vercel/blob` (storage integration), `next-auth` (session integration). The bar.
- Ask Mickael early. A two-line message is faster than a half-day rebuilding the wrong thing.
- If a CI failure looks unrelated to your change, check `main` first before assuming you caused it.
