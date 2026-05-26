# `@poli-page/nextjs` v0.1.0 Implementation Plan

> Step-by-step plan to ship v0.1.0. Each task is a single PR, reviewable in <30 min, RED→GREEN→refactor. The implementation spec at `docs/spec/nextjs-implementation.md` is the design contract; this is the execution order.

**Prerequisite**: read `docs/spec/nextjs-implementation.md` (entire), `CLAUDE.md`, and `INTEGRATIONS_PLAN.md` §"Cross-cutting DX patterns" before starting Task 1.

---

## Pre-flight: clean the inherited scaffold

**Goal**: start from a known clean slate. The `poli-page/nextjs` repo currently has SDK-template boilerplate inherited from when all integration repos were scaffolded with `.gitkeep` placeholders and an SDK-flavored `CLAUDE.md`.

- [ ] **Step 0.1: Verify what's actually in the repo**
  ```bash
  cd /Users/mickael/Projects/nextjs
  git status
  ls -la
  cat CLAUDE.md | head -20
  cat README.md
  cat CHANGELOG.md
  ```
  Expected: `CLAUDE.md` is already the integration-flavored one (replaced during the spec session), `README.md` is a 1-paragraph placeholder, `CHANGELOG.md` is empty, `src/` / `tests/` / `example-app/` contain `.gitkeep` only.

- [ ] **Step 0.2: Remove any placeholders that the bootstrap task replaces**
  ```bash
  rm -f src/.gitkeep tests/.gitkeep example-app/.gitkeep
  ```
  Do NOT remove `.git`, `.github`, `LICENSE`, `.gitignore`, `CLAUDE.md`, `docs/`.

- [ ] **Step 0.3: Confirm the SDK is reachable**
  ```bash
  ls /Users/mickael/Projects/sdk-node/dist/index.d.ts
  ls /Users/mickael/Projects/sdk-node/package.json
  ```
  If `dist/` is missing, run `cd /Users/mickael/Projects/sdk-node && npm install && npm run build` first.

---

## Task 1: Bootstrap `package.json`, tooling configs, and CI workflow

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `eslint.config.js`
- Create: `vitest.config.ts`
- Create: `tsup.config.ts`
- Create: `.github/workflows/ci.yml`
- Create: `tests/setup.ts`
- Create: `tests/unit/smoke.test.ts` (proves the pipeline runs)

**Goal**: every `npm run *` command works on a freshly cloned repo. `npm test` passes (one no-op test). CI matrix is green.

- [ ] **Step 1.1: `package.json`**

```json
{
  "name": "@poli-page/nextjs",
  "version": "0.1.0",
  "description": "Official Next.js integration for the Poli Page PDF rendering API",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist", "README.md", "CHANGELOG.md", "LICENSE"],
  "engines": { "node": ">=18.18.0" },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run --project integration-node --project integration-edge",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": {
    "next": ">=13.4.0",
    "react": ">=18"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true }
  },
  "dependencies": {
    "@poli-page/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@edge-runtime/vm": "^4.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "next": "^15.0.0",
    "react": "^18.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^4.0.0"
  },
  "publishConfig": { "access": "public" },
  "repository": { "type": "git", "url": "git+https://github.com/poli-page/nextjs.git" },
  "homepage": "https://docs.poli.page",
  "bugs": { "url": "https://github.com/poli-page/nextjs/issues" }
}
```

- [ ] **Step 1.2: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "tests/**/*", "*.config.ts", "*.config.js"],
  "exclude": ["node_modules", "dist", "example-app"]
}
```

- [ ] **Step 1.3: `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "example-app", "**/*.test.ts"]
}
```

- [ ] **Step 1.4: `eslint.config.js`**

```js
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

const restrictedNodeApis = [
  'fs', 'fs/promises', 'path', 'os', 'stream', 'child_process', 'cluster',
  'node:fs', 'node:fs/promises', 'node:path', 'node:os', 'node:stream',
  'node:child_process', 'node:cluster', 'node:buffer',
]

export default [
  {
    ignores: ['dist/', 'example-app/', 'node_modules/'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-restricted-imports': ['error', { paths: restrictedNodeApis.map(name => ({ name, message: 'Edge-runtime incompatible — src/ may only use Web standard APIs.' })) }],
      'no-restricted-globals': ['error',
        { name: 'Buffer', message: 'Edge-runtime incompatible. Use Uint8Array.' },
        { name: '__dirname', message: 'Not available in ESM / Edge.' },
        { name: '__filename', message: 'Not available in ESM / Edge.' },
      ],
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-default-export': 'off',
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    // Tests get Node APIs freely
  },
]
```

- [ ] **Step 1.5: `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration-node',
          include: ['tests/integration/**/*.node.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration-edge',
          include: ['tests/integration/**/*.edge.test.ts'],
          environment: 'edge-runtime',
        },
      },
    ],
  },
})
```

- [ ] **Step 1.6: `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  treeshake: true,
  splitting: false,
})
```

- [ ] **Step 1.7: `tests/setup.ts`** — env loading + process-listener snapshot

```ts
import { afterEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Load the bundle workspace's root .env into process.env. Real env wins.
const here = dirname(fileURLToPath(import.meta.url))
const rootEnv = resolve(here, '../../.env')   // /Users/mickael/Projects/.env (if workspace root exists)
const fallbackEnv = resolve(here, '../.env')  // nextjs/.env (per-repo)
for (const path of [rootEnv, fallbackEnv]) {
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const idx = trimmed.indexOf('=')
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = value
  }
}

// Snapshot process listeners so we catch leaks (CLAUDE.md §10.1).
const baselineUnhandled = [...process.listeners('unhandledRejection')]
const baselineUncaught = [...process.listeners('uncaughtException')]

afterEach(() => {
  for (const fn of process.listeners('unhandledRejection')) {
    if (!baselineUnhandled.includes(fn)) process.off('unhandledRejection', fn)
  }
  for (const fn of process.listeners('uncaughtException')) {
    if (!baselineUncaught.includes(fn)) process.off('uncaughtException', fn)
  }
})
```

- [ ] **Step 1.8: `tests/unit/smoke.test.ts`** — proves the pipeline

```ts
import { describe, it, expect } from 'vitest'

describe('test pipeline', () => {
  it('runs', () => {
    expect(2 + 2).toBe(4)
  })
})
```

- [ ] **Step 1.9: `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: [18, 20, 22]
        next: [14, 15]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'
      - run: npm ci
      - run: npm install --no-save next@^${{ matrix.next }}
      - run: npm run typecheck
        if: hashFiles('tsconfig.json') != ''
      - run: npm run lint
        if: hashFiles('eslint.config.js') != ''
      - run: npm test
        if: hashFiles('vitest.config.ts') != ''
      - run: npm run build
        if: hashFiles('tsup.config.ts') != ''
```

- [ ] **Step 1.10: Install and verify**

```bash
npm install
npm run typecheck   # → 0 errors
npm run lint        # → 0 errors
npm test            # → 1 passing
npm run build       # → dist/index.{js,cjs,d.ts}
```

**Acceptance**: every step green. Commit as `chore: bootstrap package.json, tsconfig, lint, vitest, tsup, ci`.

---

## Task 2: `createPoliPageClient()` — factory, env, memo, validation

**Files:**
- Create: `src/client.ts`
- Create: `tests/unit/client.test.ts`

**Goal**: factory builds a `PoliPage` from env or explicit options, validates the key shape, memoises no-arg calls.

- [ ] **Step 2.1: RED — `tests/unit/client.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPoliPageClient, __resetMemoForTests } from '../../src/client.js'

describe('createPoliPageClient', () => {
  const originalEnv = { ...process.env }
  beforeEach(() => { __resetMemoForTests() })
  afterEach(() => { process.env = { ...originalEnv } })

  it('reads apiKey from POLI_PAGE_API_KEY by default', () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_abc'
    const client = createPoliPageClient()
    expect(client).toBeDefined()
    // The SDK exposes apiKey on its instance; assert via duck-typing if needed.
  })

  it('uses explicit options over env', () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_from_env'
    const client = createPoliPageClient({ apiKey: 'pp_test_explicit' })
    // @ts-expect-error reading private for the test
    expect(client.apiKey ?? client._apiKey ?? client.config?.apiKey).toContain('explicit')
  })

  it('throws when apiKey is missing', () => {
    delete process.env.POLI_PAGE_API_KEY
    expect(() => createPoliPageClient()).toThrowError(/POLI_PAGE_API_KEY/)
  })

  it.each([
    'abcdef', 'sk_test_abc', 'pp_abc', 'pp_prod_abc',
  ])('throws on bad key prefix: %s', key => {
    expect(() => createPoliPageClient({ apiKey: key })).toThrowError(/pp_test_|pp_live_/)
  })

  it('memoises no-arg calls', () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_memo'
    const a = createPoliPageClient()
    const b = createPoliPageClient()
    expect(a).toBe(b)
  })

  it('bypasses memo when options are passed', () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_memo'
    const a = createPoliPageClient()
    const b = createPoliPageClient({ apiKey: 'pp_test_other' })
    expect(a).not.toBe(b)
  })

  it('memoises per-apiKey when reading env', () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_one'
    const a = createPoliPageClient()
    process.env.POLI_PAGE_API_KEY = 'pp_test_two'
    const b = createPoliPageClient()
    expect(a).not.toBe(b)
  })
})
```

Run → fails (`createPoliPageClient` doesn't exist).

- [ ] **Step 2.2: GREEN — `src/client.ts`**

```ts
import { PoliPage } from '@poli-page/sdk'
import type {
  PoliPageError, RequestEvent, ResponseEvent, RetryEvent,
} from '@poli-page/sdk'

// Mirrors @poli-page/sdk's PoliPageOptions exactly, except apiKey is
// optional here (we fall back to process.env.POLI_PAGE_API_KEY).
export interface PoliPageClientOptions {
  apiKey?: string
  baseUrl?: string
  maxRetries?: number
  retryDelay?: number
  timeout?: number
  onRequest?: (e: RequestEvent) => void
  onResponse?: (e: ResponseEvent) => void
  onRetry?: (e: RetryEvent) => void
  onError?: (err: PoliPageError) => void
}

const KEY_PATTERN = /^pp_(test|live)_/
const memo = new Map<string, PoliPage>()

export function createPoliPageClient(options?: PoliPageClientOptions): PoliPage {
  if (options !== undefined) return build(options)
  const apiKey = process.env.POLI_PAGE_API_KEY ?? ''
  if (apiKey === '') {
    throw new Error('POLI_PAGE_API_KEY is not set. Pass apiKey: explicitly or set the env var.')
  }
  const existing = memo.get(apiKey)
  if (existing !== undefined) return existing
  const client = build({ apiKey })
  memo.set(apiKey, client)
  return client
}

function build(options: PoliPageClientOptions): PoliPage {
  const apiKey = options.apiKey ?? process.env.POLI_PAGE_API_KEY ?? ''
  if (apiKey === '') {
    throw new Error('apiKey is required.')
  }
  if (!KEY_PATTERN.test(apiKey)) {
    throw new Error(`apiKey must start with pp_test_ or pp_live_, got: ${apiKey.slice(0, 8)}…`)
  }
  return new PoliPage({
    apiKey,
    baseUrl: options.baseUrl ?? process.env.POLI_PAGE_BASE_URL,
    maxRetries: options.maxRetries ?? parseInt_(process.env.POLI_PAGE_MAX_RETRIES),
    retryDelay: options.retryDelay ?? parseInt_(process.env.POLI_PAGE_RETRY_DELAY),
    timeout: options.timeout ?? parseInt_(process.env.POLI_PAGE_TIMEOUT),
    onRequest: options.onRequest,
    onResponse: options.onResponse,
    onRetry: options.onRetry,
    onError: options.onError,
  })
}

function parseInt_(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** @internal — tests only. Do not use in application code. */
export function __resetMemoForTests(): void {
  memo.clear()
}
```

> NOTE: this matches the SDK's actual `PoliPageOptions` shape verified in `/Users/mickael/Projects/sdk-node/dist/types.d.ts` (`apiKey`, `baseUrl`, `maxRetries`, `retryDelay`, `timeout`, `onRequest`, `onResponse`, `onRetry`, `onError`). If the SDK adds new fields later, extend this interface to match. Do NOT invent fields not present in the SDK.

Run tests → green.

- [ ] **Step 2.3: typecheck + lint pass**

```bash
npm run typecheck
npm run lint
npm test -- tests/unit/client.test.ts
```

**Acceptance**: all green. Commit as `feat: createPoliPageClient factory with env+memo+validation`.

---

## Task 3: Header utilities (RFC 5987 filename encoding)

**Files:**
- Create: `src/headers.ts`
- Create: `tests/unit/headers.test.ts`

**Goal**: filename-encoding logic that response helpers use. Direct port of `PoliPageResponseFactory`'s Symfony equivalent. Reference: `/Users/mickael/Projects/symfony-bundle/src/Http/PoliPageResponseFactory.php` and its tests in `tests/Unit/Http/PoliPageResponseFactoryTest.php`.

- [ ] **Step 3.1: RED — `tests/unit/headers.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { contentDisposition, isAsciiSafe, rfc5987Encode } from '../../src/headers.js'

describe('isAsciiSafe', () => {
  it('returns true for plain ASCII', () => {
    expect(isAsciiSafe('invoice-123.pdf')).toBe(true)
  })
  it('returns false for non-ASCII', () => {
    expect(isAsciiSafe('facture-éléphant.pdf')).toBe(false)
  })
  it('returns false for control chars', () => {
    expect(isAsciiSafe('filename.pdf')).toBe(false)
  })
})

describe('rfc5987Encode', () => {
  it('percent-encodes UTF-8 bytes for filename*', () => {
    expect(rfc5987Encode('café.pdf')).toBe('caf%C3%A9.pdf')
  })
  it('leaves ASCII alone', () => {
    expect(rfc5987Encode('plain.pdf')).toBe('plain.pdf')
  })
})

describe('contentDisposition', () => {
  it('returns attachment + ASCII filename when safe', () => {
    expect(contentDisposition('invoice.pdf', false))
      .toBe('attachment; filename="invoice.pdf"')
  })
  it('returns inline when inline:true', () => {
    expect(contentDisposition('invoice.pdf', true))
      .toBe('inline; filename="invoice.pdf"')
  })
  it('emits both ASCII fallback and filename* for non-ASCII', () => {
    expect(contentDisposition('café.pdf', false))
      .toBe(`attachment; filename="caf_.pdf"; filename*=UTF-8''caf%C3%A9.pdf`)
  })
  it('escapes embedded quotes in filename', () => {
    expect(contentDisposition('say "hi".pdf', false))
      .toContain('filename="say \\"hi\\".pdf"')
  })
})
```

- [ ] **Step 3.2: GREEN — `src/headers.ts`**

```ts
const ASCII_SAFE = /^[\x20-\x7E]+$/

export function isAsciiSafe(s: string): boolean {
  return ASCII_SAFE.test(s)
}

export function rfc5987Encode(s: string): string {
  return encodeURIComponent(s).replace(/['()]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

export function contentDisposition(filename: string, inline: boolean): string {
  const disposition = inline ? 'inline' : 'attachment'
  if (isAsciiSafe(filename)) {
    return `${disposition}; filename="${escapeQuotes(filename)}"`
  }
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_')
  const encoded = rfc5987Encode(filename)
  return `${disposition}; filename="${escapeQuotes(asciiFallback)}"; filename*=UTF-8''${encoded}`
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"')
}
```

Run → all four describe blocks green.

**Acceptance**: green. Commit as `feat: header utilities for RFC 5987 filename encoding`.

---

## Task 4: Response helpers — `pdfResponse`, `previewResponse`, `documentRedirectResponse`

**Files:**
- Create: `src/responses/pdfResponse.ts`
- Create: `src/responses/previewResponse.ts`
- Create: `src/responses/documentRedirectResponse.ts`
- Create: `tests/unit/responses/pdfResponse.test.ts`
- Create: `tests/unit/responses/previewResponse.test.ts`
- Create: `tests/unit/responses/documentRedirectResponse.test.ts`

**Goal**: each helper produces a `Response` with the documented headers. Behavior must exactly match the bundle's `PoliPageResponseFactory`.

- [ ] **Step 4.1: RED — `tests/unit/responses/pdfResponse.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { pdfResponse } from '../../../src/responses/pdfResponse.js'

const pdfBytes = new TextEncoder().encode('%PDF-1.4\nstub\n')

describe('pdfResponse', () => {
  it('sets application/pdf with attachment by default', async () => {
    const r = pdfResponse(pdfBytes, { filename: 'invoice.pdf' })
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="invoice.pdf"')
    expect(r.headers.get('cache-control')).toBe('no-store, private')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    const body = new Uint8Array(await r.arrayBuffer())
    expect(body).toEqual(pdfBytes)
  })

  it('uses inline disposition when inline:true', () => {
    const r = pdfResponse(pdfBytes, { filename: 'invoice.pdf', inline: true })
    expect(r.headers.get('content-disposition')).toBe('inline; filename="invoice.pdf"')
  })

  it('RFC 5987-encodes non-ASCII filenames', () => {
    const r = pdfResponse(pdfBytes, { filename: 'café.pdf' })
    expect(r.headers.get('content-disposition'))
      .toBe(`attachment; filename="caf_.pdf"; filename*=UTF-8''caf%C3%A9.pdf`)
  })

  it('accepts a ReadableStream body', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(pdfBytes); c.close() },
    })
    const r = pdfResponse(stream, { filename: 'x.pdf' })
    const body = new Uint8Array(await r.arrayBuffer())
    expect(body).toEqual(pdfBytes)
  })

  it('honors cacheControl override', () => {
    const r = pdfResponse(pdfBytes, { filename: 'x.pdf', cacheControl: 'public, max-age=60' })
    expect(r.headers.get('cache-control')).toBe('public, max-age=60')
  })

  it('omits filename when none provided', () => {
    const r = pdfResponse(pdfBytes)
    expect(r.headers.get('content-disposition')).toBe('attachment')
  })
})
```

- [ ] **Step 4.2: GREEN — `src/responses/pdfResponse.ts`**

```ts
import { contentDisposition } from '../headers.js'

export interface PdfResponseOptions {
  filename?: string
  inline?: boolean
  cacheControl?: string
}

export function pdfResponse(
  body: Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>,
  options: PdfResponseOptions = {},
): Response {
  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Cache-Control': options.cacheControl ?? 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
  })
  if (options.filename !== undefined) {
    headers.set('Content-Disposition', contentDisposition(options.filename, options.inline ?? false))
  } else {
    headers.set('Content-Disposition', (options.inline ?? false) ? 'inline' : 'attachment')
  }
  return new Response(body as BodyInit, { status: 200, headers })
}
```

- [ ] **Step 4.3: RED + GREEN — `previewResponse`**

```ts
// tests/unit/responses/previewResponse.test.ts
import { describe, it, expect } from 'vitest'
import { previewResponse } from '../../../src/responses/previewResponse.js'

describe('previewResponse', () => {
  it('returns text/html with no-store cache by default', async () => {
    const r = previewResponse('<h1>Hi</h1>')
    expect(r.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(r.headers.get('cache-control')).toBe('no-store, private')
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await r.text()).toBe('<h1>Hi</h1>')
  })
  it('honors cacheControl override', () => {
    const r = previewResponse('<h1>Hi</h1>', { cacheControl: 'public, max-age=300' })
    expect(r.headers.get('cache-control')).toBe('public, max-age=300')
  })
})
```

```ts
// src/responses/previewResponse.ts
export interface PreviewResponseOptions { cacheControl?: string }

export function previewResponse(html: string, options: PreviewResponseOptions = {}): Response {
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': options.cacheControl ?? 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
```

- [ ] **Step 4.4: RED + GREEN — `documentRedirectResponse`**

```ts
// tests/unit/responses/documentRedirectResponse.test.ts
import { describe, it, expect } from 'vitest'
import { documentRedirectResponse } from '../../../src/responses/documentRedirectResponse.js'

describe('documentRedirectResponse', () => {
  it('issues a 302 with the presigned url in Location', () => {
    const r = documentRedirectResponse('https://example.com/x.pdf')
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toBe('https://example.com/x.pdf')
    expect(r.headers.get('cache-control')).toBe('no-store, private')
  })
  it('issues 308 when permanent:true', () => {
    const r = documentRedirectResponse('https://example.com/x.pdf', { permanent: true })
    expect(r.status).toBe(308)
  })
})
```

```ts
// src/responses/documentRedirectResponse.ts
export interface DocumentRedirectOptions { permanent?: boolean }

export function documentRedirectResponse(
  presignedUrl: string,
  options: DocumentRedirectOptions = {},
): Response {
  return new Response(null, {
    status: options.permanent === true ? 308 : 302,
    headers: {
      Location: presignedUrl,
      'Cache-Control': 'no-store, private',
    },
  })
}
```

**Acceptance**: 3 test files, 11 assertions or so, all green. Commit as `feat: pdfResponse / previewResponse / documentRedirectResponse helpers`.

---

## Task 5: `PoliPageError` → `Response` mapper

**Files:**
- Create: `src/errors.ts`
- Create: `tests/unit/errors.test.ts`

**Goal**: typed JSON response from any `PoliPageError`. Non-`PoliPageError` does NOT get caught here — only at the route-handler factory level (Task 6).

- [ ] **Step 5.1: RED — `tests/unit/errors.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { PoliPageError } from '@poli-page/sdk'
import { poliPageErrorToResponse } from '../../src/errors.js'

describe('poliPageErrorToResponse', () => {
  it('maps 4xx to same status', async () => {
    const err = new PoliPageError('Bad version', 'INVALID_VERSION_FORMAT', 400, 'req_1')
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(400)
    expect(r.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(await r.json()).toEqual({
      code: 'INVALID_VERSION_FORMAT', message: 'Bad version', requestId: 'req_1',
    })
  })

  it('maps 5xx to same status', async () => {
    const err = new PoliPageError('boom', 'INTERNAL_ERROR', 503)
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(503)
  })

  it('maps network/no-status to 502 with NETWORK_ERROR code', async () => {
    // SDK's network errors carry code 'NETWORK_ERROR' and no status. Verify
    // the actual code name in @poli-page/sdk's PoliPageErrorCode union when
    // implementing — the union is exported alongside PoliPageError.
    const err = new PoliPageError('timeout', 'NETWORK_ERROR')
    const r = poliPageErrorToResponse(err)
    expect(r.status).toBe(502)
    const body = await r.json()
    expect(body.code).toBe('NETWORK_ERROR')
    expect(body.requestId).toBeNull()
  })

  it('sets cache-control no-store on error responses', () => {
    const r = poliPageErrorToResponse(new PoliPageError('x', 'INVALID_VERSION_FORMAT', 400))
    expect(r.headers.get('cache-control')).toBe('no-store, private')
  })
})
```

> NOTE: this matches the SDK's actual `PoliPageError` constructor verified in `/Users/mickael/Projects/sdk-node/dist/error.d.ts`: `constructor(message: string, code: PoliPageErrorCode, status?: number, requestId?: string)`. The error code strings (e.g. `'NETWORK_ERROR'`, `'INVALID_VERSION_FORMAT'`) must be members of the SDK's `PoliPageErrorCode` union — check that file for the canonical list.

- [ ] **Step 5.2: GREEN — `src/errors.ts`**

```ts
import { PoliPageError } from '@poli-page/sdk'

export function poliPageErrorToResponse(err: PoliPageError): Response {
  // SDK guarantees err.code is always a PoliPageErrorCode (required field).
  // err.status is undefined for network/timeout failures — map those to 502.
  const status =
    typeof err.status === 'number' && err.status >= 400 && err.status < 600
      ? err.status
      : 502
  const body = {
    code: err.code,
    message: err.message,
    requestId: err.requestId ?? null,
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private',
    },
  })
}
```

**Acceptance**: green. Commit as `feat: PoliPageError → Response mapper`.

---

## Task 6: `createPoliPageRouteHandler()`

**Files:**
- Create: `src/routeHandler.ts`
- Create: `tests/unit/routeHandler.test.ts`

**Goal**: the headline feature. A higher-order function that turns a render function into a Next App Router handler with correct headers, error mapping, and discriminated-union result types.

- [ ] **Step 6.1: RED — `tests/unit/routeHandler.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { PoliPageError } from '@poli-page/sdk'
import { createPoliPageRouteHandler } from '../../src/routeHandler.js'
import type { PoliPage } from '@poli-page/sdk'

const stubClient = (overrides: Partial<PoliPage> = {}): PoliPage =>
  ({ render: { pdf: vi.fn(), preview: vi.fn(), pdfStream: vi.fn() } } as unknown as PoliPage) as PoliPage

const pdfBytes = new TextEncoder().encode('%PDF-1.4\nstub\n')

const req = new Request('http://localhost/test')
const ctx = { params: Promise.resolve({ id: '42' }) }

describe('createPoliPageRouteHandler', () => {
  it('wraps a bare Uint8Array return value as a PDF response', async () => {
    const handler = createPoliPageRouteHandler(async () => pdfBytes, { client: stubClient() })
    const r = await handler(req, ctx)
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(pdfBytes)
  })

  it('handles { kind: "pdf", bytes, filename }', async () => {
    const handler = createPoliPageRouteHandler(
      async () => ({ kind: 'pdf' as const, bytes: pdfBytes, filename: 'invoice-42.pdf' }),
      { client: stubClient() },
    )
    const r = await handler(req, ctx)
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="invoice-42.pdf"')
  })

  it('handles { kind: "preview", html }', async () => {
    const handler = createPoliPageRouteHandler(
      async () => ({ kind: 'preview' as const, html: '<h1>Hi</h1>' }),
      { client: stubClient() },
    )
    const r = await handler(req, ctx)
    expect(r.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await r.text()).toBe('<h1>Hi</h1>')
  })

  it('handles { kind: "redirect", url }', async () => {
    const handler = createPoliPageRouteHandler(
      async () => ({ kind: 'redirect' as const, url: 'https://example.com/x.pdf' }),
      { client: stubClient() },
    )
    const r = await handler(req, ctx)
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toBe('https://example.com/x.pdf')
  })

  it('returns a user Response as-is', async () => {
    const userResponse = new Response('hello', { status: 418 })
    const handler = createPoliPageRouteHandler(async () => userResponse, { client: stubClient() })
    const r = await handler(req, ctx)
    expect(r).toBe(userResponse)
  })

  it('maps PoliPageError to typed JSON response', async () => {
    const handler = createPoliPageRouteHandler(
      async () => { throw new PoliPageError('bad', 'INVALID_VERSION_FORMAT', 400) },
      { client: stubClient() },
    )
    const r = await handler(req, ctx)
    expect(r.status).toBe(400)
    expect(await r.json()).toMatchObject({ code: 'INVALID_VERSION_FORMAT' })
  })

  it('rethrows non-PoliPageError', async () => {
    const handler = createPoliPageRouteHandler(
      async () => { throw new Error('boom') },
      { client: stubClient() },
    )
    await expect(handler(req, ctx)).rejects.toThrowError('boom')
  })

  it('passes resolved params + req + client to handler', async () => {
    const inner = vi.fn(async () => pdfBytes)
    const client = stubClient()
    const handler = createPoliPageRouteHandler(inner, { client })
    await handler(req, ctx)
    expect(inner).toHaveBeenCalledTimes(1)
    const arg = inner.mock.calls[0][0]
    expect(arg.req).toBe(req)
    expect(arg.params).toEqual({ id: '42' })
    expect(arg.client).toBe(client)
  })

  it('uses the memoised default client when none is passed', async () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_default'
    let captured: PoliPage | undefined
    const handler = createPoliPageRouteHandler(async ({ client }) => { captured = client; return pdfBytes })
    await handler(req, ctx)
    expect(captured).toBeDefined()
  })

  it('invokes options.onError for any error and uses its Response when returned', async () => {
    const onError = vi.fn(() => new Response('custom', { status: 503 }))
    const handler = createPoliPageRouteHandler(
      async () => { throw new Error('whatever') },
      { client: stubClient(), onError },
    )
    const r = await handler(req, ctx)
    expect(r.status).toBe(503)
    expect(await r.text()).toBe('custom')
    expect(onError).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6.2: GREEN — `src/routeHandler.ts`**

```ts
import type { PoliPage, PoliPageError as PoliPageErrorType } from '@poli-page/sdk'
import { PoliPageError } from '@poli-page/sdk'
import { createPoliPageClient } from './client.js'
import { pdfResponse } from './responses/pdfResponse.js'
import { previewResponse } from './responses/previewResponse.js'
import { documentRedirectResponse } from './responses/documentRedirectResponse.js'
import { poliPageErrorToResponse } from './errors.js'

export interface RouteHandlerContext<TParams> {
  req: Request
  params: TParams
  client: PoliPage
}

export type RouteHandlerResult =
  | Uint8Array
  | ArrayBuffer
  | ReadableStream<Uint8Array>
  | { kind: 'pdf'; bytes: Uint8Array | ArrayBuffer; filename?: string; inline?: boolean }
  | { kind: 'stream'; stream: ReadableStream<Uint8Array>; filename?: string; inline?: boolean }
  | { kind: 'preview'; html: string }
  | { kind: 'redirect'; url: string; permanent?: boolean }
  | Response

export interface RouteHandlerOptions<TParams = Record<string, string>> {
  client?: PoliPage
  onError?: (err: unknown, ctx: RouteHandlerContext<TParams>) => Response | void
}

export function createPoliPageRouteHandler<TParams = Record<string, string>>(
  handler: (ctx: RouteHandlerContext<TParams>) => Promise<RouteHandlerResult>,
  options: RouteHandlerOptions<TParams> = {},
): (req: Request, ctx: { params: Promise<TParams> }) => Promise<Response> {
  return async (req, ctx) => {
    const params = await ctx.params
    const client = options.client ?? createPoliPageClient()
    const routeCtx: RouteHandlerContext<TParams> = { req, params, client }
    try {
      const result = await handler(routeCtx)
      return materialise(result)
    } catch (err) {
      if (options.onError !== undefined) {
        const custom = options.onError(err, routeCtx)
        if (custom !== undefined) return custom
      }
      if (err instanceof PoliPageError) {
        return poliPageErrorToResponse(err as PoliPageErrorType)
      }
      throw err
    }
  }
}

function materialise(result: RouteHandlerResult): Response {
  if (result instanceof Response) return result
  if (result instanceof Uint8Array || result instanceof ArrayBuffer) {
    return pdfResponse(result)
  }
  if (result instanceof ReadableStream) {
    return pdfResponse(result)
  }
  switch (result.kind) {
    case 'pdf':
      return pdfResponse(result.bytes, {
        filename: result.filename,
        inline: result.inline,
      })
    case 'stream':
      return pdfResponse(result.stream, {
        filename: result.filename,
        inline: result.inline,
      })
    case 'preview':
      return previewResponse(result.html)
    case 'redirect':
      return documentRedirectResponse(result.url, { permanent: result.permanent })
  }
}
```

**Acceptance**: 10 assertions green. Commit as `feat: createPoliPageRouteHandler with discriminated-union result`.

---

## Task 7: Public `src/index.ts`

**Files:**
- Create: `src/index.ts`
- Create: `tests/unit/index.test.ts`

**Goal**: the package's only public entry point. Tree-shakeable named re-exports.

- [ ] **Step 7.1: RED**

```ts
// tests/unit/index.test.ts
import { describe, it, expect } from 'vitest'
import * as pkg from '../../src/index.js'

describe('public exports', () => {
  it('exposes the documented surface and nothing else', () => {
    expect(Object.keys(pkg).sort()).toEqual([
      'createPoliPageClient',
      'createPoliPageRouteHandler',
      'documentRedirectResponse',
      'pdfResponse',
      'previewResponse',
    ])
  })
})
```

- [ ] **Step 7.2: GREEN — `src/index.ts`**

```ts
export { createPoliPageClient } from './client.js'
export type { PoliPageClientOptions } from './client.js'

export { createPoliPageRouteHandler } from './routeHandler.js'
export type {
  RouteHandlerContext,
  RouteHandlerOptions,
  RouteHandlerResult,
} from './routeHandler.js'

export { pdfResponse } from './responses/pdfResponse.js'
export type { PdfResponseOptions } from './responses/pdfResponse.js'

export { previewResponse } from './responses/previewResponse.js'
export type { PreviewResponseOptions } from './responses/previewResponse.js'

export { documentRedirectResponse } from './responses/documentRedirectResponse.js'
export type { DocumentRedirectOptions } from './responses/documentRedirectResponse.js'

// Re-export selected SDK types users will need at the integration boundary.
export type { PoliPage, PoliPageError, ProjectModeInput, InlineModeInput, RetryEvent } from '@poli-page/sdk'
```

**Acceptance**: index test green, `npm run build` succeeds, `dist/index.d.ts` lists the same surface. Commit as `feat: public index.ts and tree-shakeable re-exports`.

---

## Task 8: Edge runtime integration test

**Files:**
- Create: `tests/integration/renderAgainstDevelopApi.edge.test.ts`
- Modify: `vitest.config.ts` (verify `integration-edge` project is wired)

**Goal**: prove `src/` runs under Edge by importing every public export inside the `edge-runtime` Vitest environment and exercising them with a mock SDK client.

- [ ] **Step 8.1: write the Edge integration test**

```ts
import { describe, it, expect, vi } from 'vitest'
import {
  createPoliPageClient,
  createPoliPageRouteHandler,
  pdfResponse,
  previewResponse,
  documentRedirectResponse,
} from '../../src/index.js'

describe('edge-runtime compatibility', () => {
  it('imports all public exports without Node-only API errors', () => {
    expect(typeof createPoliPageClient).toBe('function')
    expect(typeof createPoliPageRouteHandler).toBe('function')
    expect(typeof pdfResponse).toBe('function')
    expect(typeof previewResponse).toBe('function')
    expect(typeof documentRedirectResponse).toBe('function')
  })

  it('runs pdfResponse with a Uint8Array body', async () => {
    const r = pdfResponse(new TextEncoder().encode('%PDF-1.4\n'))
    expect(r.headers.get('content-type')).toBe('application/pdf')
    const buf = new Uint8Array(await r.arrayBuffer())
    expect(buf[0]).toBe(0x25) // %
  })

  it('runs the route handler factory with a mocked client', async () => {
    const mockClient = {
      render: { pdf: vi.fn(async () => new TextEncoder().encode('%PDF-1.4\n')) },
    } as any
    const handler = createPoliPageRouteHandler(
      async ({ client }) => client.render.pdf({} as any),
      { client: mockClient },
    )
    const r = await handler(new Request('http://x'), { params: Promise.resolve({}) })
    expect(r.headers.get('content-type')).toBe('application/pdf')
  })

  it('Buffer is not used inside src/ (assertion via lint, but smoke here too)', () => {
    expect(typeof (globalThis as any).Buffer).toBe('undefined')
  })
})
```

**Acceptance**: `npm test -- --project integration-edge` passes. Commit as `test: edge-runtime integration test`.

---

## Task 9: Real-API integration test (Node + Edge)

**Files:**
- Create: `tests/integration/renderAgainstDevelopApi.node.test.ts`
- Already wired: `tests/integration/renderAgainstDevelopApi.edge.test.ts` extends from Task 8

**Goal**: ONE happy-path round-trip against `api-develop.poli.page` rendering `getting-started/welcome`. Skipped when the key is missing.

- [ ] **Step 9.1: Write the Node integration test**

```ts
import { describe, it, expect } from 'vitest'
import { createPoliPageClient } from '../../src/index.js'

const skip = process.env.POLI_PAGE_API_KEY === undefined
  || !process.env.POLI_PAGE_API_KEY.startsWith('pp_test_')

describe.skipIf(skip)('render welcome against develop API (node runtime)', () => {
  it('returns a PDF', async () => {
    const client = createPoliPageClient({
      apiKey: process.env.POLI_PAGE_API_KEY!,
      baseUrl: 'https://api-develop.poli.page',
    })
    const pdf = await client.render.pdf({
      project: 'getting-started',
      template: 'welcome',
      data: { name: 'nextjs integration test' },
      version: '1.0.0',
    })
    const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf)
    expect(bytes.byteLength).toBeGreaterThan(1000)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  }, 30_000)
})
```

- [ ] **Step 9.2: Extend the Edge integration test from Task 8 with the same real-API test**

Add a second `describe.skipIf(skip)` block to `renderAgainstDevelopApi.edge.test.ts` that calls the real API. The point is to prove the SDK works under Edge, not just our helpers.

**Acceptance**: `npm run test:integration` with `POLI_PAGE_API_KEY` set in env → 2 real-API tests pass (one per runtime). Without the key → both skip cleanly. Commit as `test: real-api integration test on node and edge runtimes`.

---

## Task 10: Example app — Next 15 scaffold + 10 demo routes

**Files** (all under `example-app/`):
- Create: `example-app/package.json`
- Create: `example-app/next.config.ts`
- Create: `example-app/tsconfig.json`
- Create: `example-app/app/layout.tsx`
- Create: `example-app/app/render/pdf/route.ts`
- Create: `example-app/app/render/stream/route.ts`
- Create: `example-app/app/render/preview/route.ts`
- Create: `example-app/app/documents/route.ts`
- Create: `example-app/app/documents/[id]/route.ts`
- Create: `example-app/app/documents/[id]/preview/route.ts`
- Create: `example-app/app/documents/[id]/thumbnails/route.ts`
- Create: `example-app/app/errors/bad-version/route.ts`
- Create: `example-app/scripts/render-to-file.ts`
- Create: `example-app/.gitignore`

**Goal**: 9 routes covering SDK demo steps 1, 2, 4–10, and one standalone CLI script for step 3. All routes call into `@poli-page/nextjs` for the response shape.

- [ ] **Step 10.1: `example-app/package.json`**

```json
{
  "name": "poli-page-nextjs-example",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "render-to-file": "tsx scripts/render-to-file.ts"
  },
  "dependencies": {
    "@poli-page/nextjs": "*",
    "@poli-page/sdk": "^1.0.0",
    "next": "^15.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0"
  }
}
```

In dev (workspace mode) the `"@poli-page/nextjs": "*"` resolves to `../`. Publishable consumers replace it with a pinned version.

- [ ] **Step 10.2: `example-app/next.config.ts` — load root `.env`**

```ts
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const candidates = [
  resolve(here, '../.env'),         // bundle workspace root
  resolve(here, '.env'),            // per-app fallback
]
for (const path of candidates) {
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const idx = trimmed.indexOf('=')
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = value
  }
}

const nextConfig = { experimental: { typedRoutes: true } }
export default nextConfig
```

- [ ] **Step 10.3: Routes — one example, others follow the pattern**

```ts
// app/render/pdf/route.ts
import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler(async ({ client }) => {
  return {
    kind: 'pdf' as const,
    bytes: await client.render.pdf({
      project: 'getting-started',
      template: 'welcome',
      data: { name: 'World' },
      version: '1.0.0',
    }),
    filename: 'welcome.pdf',
    inline: true,
  }
})
```

```ts
// app/render/stream/route.ts
import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler(async ({ client }) => ({
  kind: 'stream' as const,
  stream: await client.render.pdfStream({
    project: 'getting-started', template: 'welcome',
    data: { name: 'World' }, version: '1.0.0',
  }),
  filename: 'welcome.pdf',
  inline: true,
}))
```

```ts
// app/render/preview/route.ts
import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler(async ({ client, req }) => {
  const inlineHtml = new URL(req.url).searchParams.get('html')
  const result = inlineHtml !== null
    ? await client.render.preview({ template: inlineHtml, data: {} })
    : await client.render.preview({
        project: 'getting-started', template: 'welcome',
        data: { name: 'World' }, version: '1.0.0',
      })
  return { kind: 'preview' as const, html: result.html }
})
```

```ts
// app/documents/route.ts — POST /documents (step 5)
import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const POST = createPoliPageRouteHandler(async ({ client }) => {
  const descriptor = await client.render.document({
    project: 'getting-started', template: 'welcome',
    data: { name: 'Stored doc' }, version: '1.0.0',
  })
  return new Response(JSON.stringify(descriptor), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
```

```ts
// app/documents/[id]/route.ts — GET (step 6) + DELETE (step 9)
import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler<{ id: string }>(async ({ client, params }) => {
  const descriptor = await client.documents.get(params.id)
  return { kind: 'redirect' as const, url: descriptor.presignedPdfUrl }
})

export const DELETE = createPoliPageRouteHandler<{ id: string }>(async ({ client, params }) => {
  await client.documents.delete(params.id)
  return new Response(null, { status: 204 })
})
```

```ts
// app/documents/[id]/thumbnails/route.ts — step 7
import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler<{ id: string }>(async ({ client, params }) => {
  const result = await client.documents.thumbnails(params.id)
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
```

```ts
// app/documents/[id]/preview/route.ts — step 8
import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler<{ id: string }>(async ({ client, params }) => {
  const result = await client.documents.preview(params.id)
  return { kind: 'preview' as const, html: result.html }
})
```

```ts
// app/errors/bad-version/route.ts — step 10
import { createPoliPageRouteHandler } from '@poli-page/nextjs'

export const GET = createPoliPageRouteHandler(async ({ client }) => {
  await client.render.pdf({
    project: 'getting-started', template: 'welcome', data: {}, version: 'not-a-version',
  })
  return new Response('unreachable', { status: 500 })
})
```

- [ ] **Step 10.4: `example-app/scripts/render-to-file.ts` — SDK demo step 3**

```ts
import { writeFileSync } from 'node:fs'
import { createPoliPageClient } from '@poli-page/nextjs'

const client = createPoliPageClient()
const pdf = await client.render.pdf({
  project: 'getting-started', template: 'welcome',
  data: { name: 'renderToFile demo' }, version: '1.0.0',
})
const path = '/tmp/poli-page-demo-file.pdf'
writeFileSync(path, new Uint8Array(pdf as ArrayBuffer))
console.log(`Wrote ${path} (${(pdf as Uint8Array).byteLength} bytes)`)
```

- [ ] **Step 10.5: Smoke**

```bash
cd example-app
npm install
npm run dev
# in another terminal:
curl -o /tmp/welcome.pdf http://localhost:3000/render/pdf
head -c 8 /tmp/welcome.pdf
# → %PDF-1.4
```

**Acceptance**: every route returns the expected response. Commit as `feat(example-app): all 10 SDK demo routes + render-to-file script`.

---

## Task 11: Example app — interactive demo UI at `/`

**Files:**
- Create: `example-app/app/page.tsx`
- Create: `example-app/app/globals.css` (if needed; prefer inline `<style>`)

**Goal**: port the symfony-bundle's `templates/demo.html` interactive dashboard to a Next Client Component. Same aesthetic, same 9-button layout, same JS state machine for the document lifecycle.

- [ ] **Step 11.1: Create `example-app/app/page.tsx` as a Client Component**

Copy the structure from `/Users/mickael/Projects/symfony-bundle/example-app/templates/demo.html`:
- Same `<style>` block (CSS custom properties, Manrope display sans, IBM Plex Sans body, JetBrains Mono code, brand color `#4f5d99`).
- Translate the HTML structure into JSX.
- Translate the inline `<script>` IIFE into React state + handlers — `useState` for `docId`, `useState<Map<string, ResultState>>` keyed by panel id for results.
- All routes are at the same relative paths (`/render/pdf`, `/documents`, etc.) — `fetch()` calls don't change.
- The CLI section's `Copy` buttons port to React click handlers.

Behavior parity with the bundle's dashboard is the acceptance bar.

- [ ] **Step 11.2: Layout**

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Sans:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 11.3: Smoke**

```bash
cd example-app && npm run dev
open http://localhost:3000
# Press every button. Confirm parity with the symfony-bundle dashboard.
```

**Acceptance**: dashboard renders, all 9 buttons work, document lifecycle gating works. Commit as `feat(example-app): interactive demo dashboard at /`.

---

## Task 12: README and CHANGELOG for v0.1.0

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Goal**: ship a README under 250 lines covering the public API + Edge note + example-app pointer. Match the symfony-bundle README's structure.

- [ ] **Step 12.1: `README.md`**

Structure:
1. Title + badges (CI, npm version, license)
2. One-paragraph pitch
3. `npm install @poli-page/nextjs`
4. Quick start — `createPoliPageRouteHandler` example (8 lines)
5. `pdfResponse` example for users with their own handler
6. Edge runtime — one-line opt-in (`export const runtime = 'edge'`)
7. Streaming example
8. Server Component pattern (4-line example, no new API)
9. Error handling — only `PoliPageError` is mapped
10. Pointer to `example-app/` for the interactive demo
11. Full env reference (`POLI_PAGE_API_KEY` + optional ones)
12. Contributing → `CLAUDE.md`
13. License → MIT

- [ ] **Step 12.2: `CHANGELOG.md`**

```markdown
# Changelog

All notable changes to `@poli-page/nextjs` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release scaffolding.

## [0.1.0] — YYYY-MM-DD

### Added
- `createPoliPageClient()` — memoised factory reading from `process.env.POLI_PAGE_API_KEY`.
- `createPoliPageRouteHandler()` — App Router route handler factory with discriminated-union result types, error→Response mapping, and Web Streams API support.
- Response helpers: `pdfResponse()`, `previewResponse()`, `documentRedirectResponse()`. RFC 5987 filename encoding for non-ASCII names. Default headers: `Cache-Control: no-store, private`, `X-Content-Type-Options: nosniff`.
- First-class Edge runtime support: all helpers tested under `@edge-runtime/vm` in CI.
- `tests/setup.ts` snapshots `process` listeners to catch leaks (carry from symfony-bundle pattern).
- Example Next 15 App Router app at `example-app/` covering all 10 SDK demo steps, with an interactive demo dashboard at `/` matching the symfony-bundle's pattern.

[Unreleased]: https://github.com/poli-page/nextjs/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/poli-page/nextjs/releases/tag/v0.1.0
```

**Acceptance**: README under 250 lines, CHANGELOG present. Commit as `docs: README and CHANGELOG for v0.1.0`.

---

## Task 13: Final pass — verify, tag, publish dry-run

**Files**: none (operational task)

- [ ] **Step 13.1: Full local CI**
  ```bash
  npm ci
  npm run typecheck
  npm run lint
  npm test
  npm run build
  ```
  All green.

- [ ] **Step 13.2: Verify dist/ shape**
  ```bash
  ls dist/
  # → index.js (ESM)
  # → index.cjs (CJS)
  # → index.d.ts (types)
  # → index.d.cts (types for CJS)
  ```

- [ ] **Step 13.3: Pack dry-run**
  ```bash
  npm pack --dry-run
  ```
  Verify the package only includes `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE`. No source, no tests, no `example-app/`.

- [ ] **Step 13.4: Smoke-test example-app from a clean install**
  ```bash
  cd example-app
  rm -rf node_modules
  npm install
  npm run dev
  # Browser: http://localhost:3000 → click every button.
  ```

- [ ] **Step 13.5: Tag v0.1.0**
  ```bash
  git tag -a v0.1.0 -m 'v0.1.0 — initial release'
  git push origin v0.1.0
  ```

- [ ] **Step 13.6: Publish** (when ready, separate decision)
  ```bash
  npm publish --access public
  ```

---

## Summary — commit timeline

| Task | Commit message | Approx lines added |
|---|---|---|
| 1 | `chore: bootstrap package.json, tsconfig, lint, vitest, tsup, ci` | ~250 |
| 2 | `feat: createPoliPageClient factory with env+memo+validation` | ~150 |
| 3 | `feat: header utilities for RFC 5987 filename encoding` | ~70 |
| 4 | `feat: pdfResponse / previewResponse / documentRedirectResponse helpers` | ~180 |
| 5 | `feat: PoliPageError → Response mapper` | ~60 |
| 6 | `feat: createPoliPageRouteHandler with discriminated-union result` | ~250 |
| 7 | `feat: public index.ts and tree-shakeable re-exports` | ~40 |
| 8 | `test: edge-runtime integration test` | ~50 |
| 9 | `test: real-api integration test on node and edge runtimes` | ~80 |
| 10 | `feat(example-app): all 10 SDK demo routes + render-to-file script` | ~250 |
| 11 | `feat(example-app): interactive demo dashboard at /` | ~600 |
| 12 | `docs: README and CHANGELOG for v0.1.0` | ~200 |

Total: ~2,180 lines across 12 PRs. Each reviewable in under 30 minutes. Compare to symfony-bundle's ~3,000 lines across 12 PRs — Next.js's tighter framework surface translates directly to a smaller package.

This document is the source of truth for execution order. If a PR's scope deviates from a Task, update this plan FIRST in the same PR, with reasoning in the description.
