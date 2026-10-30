/**
 * Conformance with the Poli Page API contract (https://github.com/poli-page/api-contract).
 *
 * CI copies the pinned `contract.json` with the `poli-page/api-contract` action and sets
 * `POLI_CONTRACT` to its path. Every `kind: 'impl'` case runs against the example app, served by
 * a real Next.js production server started in this process from the example app's build
 * (`example-app/.next`, built against this repo's `dist/`). A local HTTP server answers the
 * case's `responses` in order and records each request; the example app's SDK points at it
 * through `POLI_PAGE_BASE_URL` (read by `createPoliPageClient()`), the case's `request` is sent
 * to the Next server over HTTP, and the app's answer and the recorded requests are compared with
 * the case's `expect`. `sdk` cases are the SDK's own and are ignored here. The SDK's retry
 * settings are the defaults.
 *
 * `tests/contract-skip.json` maps the case ids allowed to fail to the reason. A listed case that
 * passes, or a listed id the contract does not have, fails the run.
 *
 * Locally: build first (`npm run build`, then `npm ci && npm run build` in `example-app/`), then
 * `POLI_CONTRACT=/path/to/contract.json npm test`. Without POLI_CONTRACT the suite is skipped,
 * except in CI, where a missing contract is an error.
 */
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type RequestListener,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Contract format 1 (README of poli-page/api-contract)
// ---------------------------------------------------------------------------

const KNOWN_FORMAT_VERSION = 1

/** The example app's key: a well-formed sandbox key, `pp_sandbox_` + 32 hex. */
const TEST_API_KEY = 'pp_sandbox_0123456789abcdef0123456789abcdef'

/** The slowest cases retry twice with the SDK's default backoff (at most 2.25 s in all). */
const CASE_TIMEOUT_MS = 30_000

const here = dirname(fileURLToPath(import.meta.url))
const EXAMPLE_APP = resolve(here, '../../example-app')
const SKIP_LIST = resolve(here, '../contract-skip.json')

interface MockResponse {
  status: number
  headers?: Readonly<Record<string, string>>
  json?: unknown
  text?: string
  base64?: string
}

interface MockFault {
  fault: 'drop' | 'hang'
}

type MockStep = MockResponse | MockFault

interface ExpectedRequest {
  method: string
  path: string
  auth: 'bearer' | 'none'
  idempotencyKey: 'stable' | 'absent'
}

interface ImplExpect {
  status: number
  location?: string
  contentType?: string
  json?: unknown
  requests?: readonly ExpectedRequest[]
}

interface ImplCase {
  kind: 'impl'
  id: string
  title: string
  request: { method: string; path: string }
  responses: readonly MockStep[]
  expect: ImplExpect
}

interface ContractCase {
  kind: string
  id: string
}

interface Contract {
  formatVersion: number
  cases: readonly ContractCase[]
}

/** The `expect` fields this file compares; any other field fails the case. */
const KNOWN_EXPECT_FIELDS = new Set(['status', 'location', 'contentType', 'json', 'requests'])

function isImplCase(c: ContractCase): c is ImplCase {
  return c.kind === 'impl'
}

function loadContract(path: string): Contract {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || !('formatVersion' in parsed)) {
    throw new Error(`${path} is not a contract.json: it has no formatVersion`)
  }
  if (parsed.formatVersion !== KNOWN_FORMAT_VERSION) {
    throw new Error(
      `contract.json formatVersion ${String(parsed.formatVersion)} is not supported ` +
        `(this test reads format ${KNOWN_FORMAT_VERSION}): update tests/contract/contract.test.ts`,
    )
  }
  if (!('cases' in parsed) || !Array.isArray(parsed.cases)) {
    throw new Error(`${path} has no cases array`)
  }
  return parsed as Contract
}

function loadSkipList(): Readonly<Record<string, string>> {
  const parsed: unknown = JSON.parse(readFileSync(SKIP_LIST, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('tests/contract-skip.json must be an object of case id to reason')
  }
  const skip: Record<string, string> = {}
  for (const [id, reason] of Object.entries(parsed)) {
    if (typeof reason !== 'string' || reason.trim() === '') {
      throw new Error(`tests/contract-skip.json: "${id}" needs a reason`)
    }
    skip[id] = reason
  }
  return skip
}

// ---------------------------------------------------------------------------
// Placeholders: {{mock}}, {{httpDate+N}}
// ---------------------------------------------------------------------------

function substitute(value: unknown, mock: string): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{([^}]*)\}\}/g, (_match, name: string) => {
      if (name === 'mock') return mock
      const date = /^httpDate\+(\d+)$/.exec(name)
      if (date) {
        // An HTTP-date has whole seconds: round to the nearest one.
        const at = Date.now() + Number(date[1]) * 1000
        return new Date(Math.round(at / 1000) * 1000).toUTCString()
      }
      throw new Error(`Unknown contract placeholder {{${name}}}`)
    })
  }
  if (Array.isArray(value)) return value.map((item) => substitute(item, mock))
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, substitute(item, mock)]),
    )
  }
  return value
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function listen(handler: RequestListener): Promise<{ server: Server; origin: string }> {
  const server = createServer(handler)
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address() as AddressInfo
  return { server, origin: `http://127.0.0.1:${port}` }
}

function closeServer(server: Server): Promise<void> {
  return new Promise<void>((done) => {
    server.closeAllConnections()
    server.close(() => done())
  })
}

interface HttpAnswer {
  status: number
  headers: IncomingHttpHeaders
  body: Buffer
}

/** One request, no redirect following: the app's own answer. */
function send(origin: string, method: string, path: string): Promise<HttpAnswer> {
  return new Promise((done, fail) => {
    const req = httpRequest(new URL(path, origin), { method }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () =>
        done({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
      )
      res.on('error', fail)
    })
    req.on('error', fail)
    req.end()
  })
}

// ---------------------------------------------------------------------------
// Mock Poli Page API
// ---------------------------------------------------------------------------

interface RecordedRequest {
  method: string
  path: string
  headers: IncomingMessage['headers']
}

interface MockServer {
  origin: string
  requests: RecordedRequest[]
  close(): Promise<void>
}

function answer(res: ServerResponse, step: MockResponse, origin: string): void {
  const headers = substitute(step.headers ?? {}, origin) as Record<string, string>
  const hasHeader = (name: string): boolean =>
    Object.keys(headers).some((key) => key.toLowerCase() === name)
  let body: string | Buffer | undefined
  if (step.json !== undefined) {
    body = JSON.stringify(substitute(step.json, origin))
    if (!hasHeader('content-type')) headers['content-type'] = 'application/json'
  } else if (step.text !== undefined) {
    body = step.text
  } else if (step.base64 !== undefined) {
    body = Buffer.from(step.base64, 'base64')
  }
  res.writeHead(step.status, headers)
  res.end(body)
}

async function startMockServer(steps: readonly MockStep[]): Promise<MockServer> {
  const requests: RecordedRequest[] = []
  let origin = ''
  const started = await listen((req, res) => {
    req.resume()
    req.on('end', () => {
      requests.push({ method: req.method ?? '', path: req.url ?? '', headers: req.headers })
      const step = steps[requests.length - 1]
      if (step === undefined) {
        // More requests than the case has answers: make it visible in the diff.
        answer(res, { status: 599, json: { error: 'MOCK_EXHAUSTED' } }, origin)
      } else if ('fault' in step) {
        if (step.fault === 'drop') req.socket.destroy()
        // 'hang': never answer.
      } else {
        answer(res, step, origin)
      }
    })
  })
  origin = started.origin
  return { origin, requests, close: () => closeServer(started.server) }
}

// ---------------------------------------------------------------------------
// The example app on a Next.js production server
// ---------------------------------------------------------------------------

interface NextServerLike {
  prepare(): Promise<void>
  getRequestHandler(): (req: IncomingMessage, res: ServerResponse) => Promise<void>
  close(): Promise<void>
}

type CreateNextServer = (options: { dir: string; dev: boolean; quiet: boolean }) => NextServerLike

interface ExampleApp {
  origin: string
  close(): Promise<void>
}

async function startExampleApp(): Promise<ExampleApp> {
  if (!existsSync(resolve(EXAMPLE_APP, '.next/BUILD_ID'))) {
    throw new Error(
      'example-app is not built: run `npm run build`, then `npm ci && npm run build` in example-app/',
    )
  }
  // The example app's own Next.js, the one that built `.next`.
  const loaded: unknown = createRequire(resolve(EXAMPLE_APP, 'package.json'))('next')
  if (typeof loaded !== 'function') throw new Error('example-app: next does not export a function')
  const createNextServer = loaded as CreateNextServer
  const app = createNextServer({ dir: EXAMPLE_APP, dev: false, quiet: true })
  await app.prepare()
  const handle = app.getRequestHandler()
  const { server, origin } = await listen((req, res) => {
    void handle(req, res)
  })
  return {
    origin,
    close: async () => {
      await closeServer(server)
      await app.close()
    },
  }
}

// ---------------------------------------------------------------------------
// Running and comparing one case
// ---------------------------------------------------------------------------

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function header(req: RecordedRequest, name: string): string | undefined {
  const value = req.headers[name]
  return Array.isArray(value) ? value.join(', ') : value
}

/**
 * The recorded requests in the shape of `expect.requests`. A field that breaks the expectation
 * keeps the observed value, so the diff shows it. `stable` means the same lowercase UUID v4 on
 * every attempt of the one SDK call a case makes.
 */
function describeRequests(recorded: readonly RecordedRequest[]): unknown[] {
  let firstKey: string | undefined
  return recorded.map((req) => {
    const authorization = header(req, 'authorization')
    const auth =
      authorization === undefined
        ? 'none'
        : authorization === `Bearer ${TEST_API_KEY}`
          ? 'bearer'
          : `unexpected Authorization: ${authorization}`
    const key = header(req, 'idempotency-key')
    let idempotencyKey: string
    if (key === undefined) {
      idempotencyKey = 'absent'
    } else if (!UUID_V4.test(key)) {
      idempotencyKey = `not a lowercase UUID v4: ${key}`
    } else {
      firstKey ??= key
      idempotencyKey = key === firstKey ? 'stable' : `changed: ${firstKey} then ${key}`
    }
    return { method: req.method, path: req.path, auth, idempotencyKey }
  })
}

/** The media type of a Content-Type header, without parameters such as charset. */
function mediaType(contentType: string | undefined): string | undefined {
  return contentType?.split(';')[0]?.trim().toLowerCase()
}

/**
 * Sets the example app's environment for one case, and gives back a function that restores it.
 * The SDK's retry and timeout settings are unset, so a local `.env` cannot change the defaults
 * the cases expect.
 */
function exampleAppEnv(baseUrl: string): () => void {
  const names = [
    'POLI_PAGE_API_KEY',
    'POLI_PAGE_BASE_URL',
    'POLI_PAGE_MAX_RETRIES',
    'POLI_PAGE_RETRY_DELAY',
    'POLI_PAGE_TIMEOUT',
  ] as const
  const saved = names.map((name) => [name, process.env[name]] as const)
  delete process.env.POLI_PAGE_MAX_RETRIES
  delete process.env.POLI_PAGE_RETRY_DELAY
  delete process.env.POLI_PAGE_TIMEOUT
  process.env.POLI_PAGE_API_KEY = TEST_API_KEY
  process.env.POLI_PAGE_BASE_URL = baseUrl
  return () => {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

async function runCase(app: ExampleApp, c: ImplCase): Promise<void> {
  const unknownFields = Object.keys(c.expect).filter((field) => !KNOWN_EXPECT_FIELDS.has(field))
  expect(unknownFields).toEqual([])

  const server = await startMockServer(c.responses)
  const restoreEnv = exampleAppEnv(server.origin)
  try {
    const req = substitute(c.request, server.origin) as ImplCase['request']
    const res = await send(app.origin, req.method, req.path)

    const want = substitute(c.expect, server.origin) as ImplExpect
    expect(res.status).toBe(want.status)
    if (want.location !== undefined) {
      expect(res.headers.location).toBe(want.location)
    }
    if (want.contentType !== undefined) {
      expect(mediaType(res.headers['content-type'])).toBe(mediaType(want.contentType))
    }
    if (want.json !== undefined) {
      // Deep equality with the exact key set.
      expect(JSON.parse(res.body.toString('utf8')) as unknown).toStrictEqual(want.json)
    }
    if (want.requests !== undefined) {
      expect(describeRequests(server.requests)).toEqual(want.requests)
    }
  } finally {
    restoreEnv()
    await server.close()
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

const contractPath = process.env.POLI_CONTRACT

if (!contractPath) {
  if (process.env.CI) {
    describe('API contract', () => {
      it('POLI_CONTRACT is set', () => {
        throw new Error(
          'POLI_CONTRACT is not set: in CI the "API contract" step must provide ' +
            'contract.json (poli-page/api-contract action, output `path`)',
        )
      })
    })
  } else {
    describe.skip('API contract (skipped: set POLI_CONTRACT to a contract.json path)', () => {
      it('runs the impl cases against the example app', () => {})
    })
  }
} else {
  const contract = loadContract(contractPath)
  const skip = loadSkipList()
  const implCases = contract.cases.filter(isImplCase)

  describe('API contract', () => {
    let app: ExampleApp | undefined

    beforeAll(async () => {
      app = await startExampleApp()
    }, 60_000)

    afterAll(async () => {
      await app?.close()
    })

    function exampleApp(): ExampleApp {
      if (app === undefined) throw new Error('the example app did not start')
      return app
    }

    it('has impl cases, and no case of a kind this test does not know', () => {
      expect(implCases.length).toBeGreaterThan(0)
      const unknownKinds = contract.cases
        .map((c) => c.kind)
        .filter((kind) => kind !== 'sdk' && kind !== 'impl')
      expect(unknownKinds).toEqual([])
    })

    it('contract-skip.json lists only impl cases of the contract', () => {
      const known = new Set(implCases.map((c) => c.id))
      const unknown = Object.keys(skip).filter((id) => !known.has(id))
      // Ids the contract does not have: remove them from contract-skip.json.
      expect(unknown).toEqual([])
    })

    // One test per case, named by its id.
    for (const c of implCases) {
      it(
        c.id,
        async () => {
          const reason = skip[c.id]
          if (reason === undefined) {
            await runCase(exampleApp(), c)
            return
          }
          let failed = false
          try {
            await runCase(exampleApp(), c)
          } catch {
            failed = true
          }
          if (!failed) {
            throw new Error(
              `${c.id} passes now (it was expected to fail: ${reason}): ` +
                'remove it from tests/contract-skip.json',
            )
          }
        },
        CASE_TIMEOUT_MS,
      )
    }
  })
}
