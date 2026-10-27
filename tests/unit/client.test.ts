import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { MockInstance } from 'vitest'

vi.mock('@poli-page/sdk', async () => {
  const actual = await vi.importActual<typeof import('@poli-page/sdk')>('@poli-page/sdk')
  return {
    ...actual,
    PoliPage: vi.fn(function PoliPage(this: { options: unknown }, options: unknown) {
      this.options = options
    }),
  }
})

import { PoliPage } from '@poli-page/sdk'
import { createPoliPageClient, __resetMemoForTests } from '../../src/client.js'

const PoliPageMock = vi.mocked(PoliPage)

const SECRET = '0123456789abcdef0123456789abcdef'
const SANDBOX_KEY = `pp_sandbox_${SECRET}`
const sandboxKey = (hexChar: string): string => `pp_sandbox_${hexChar.repeat(32)}`

describe('createPoliPageClient', () => {
  const originalEnv = { ...process.env }
  let warn: MockInstance<typeof console.warn>
  beforeEach(() => {
    __resetMemoForTests()
    PoliPageMock.mockClear()
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    delete process.env.POLI_PAGE_API_KEY
    delete process.env.POLI_PAGE_BASE_URL
    delete process.env.POLI_PAGE_MAX_RETRIES
    delete process.env.POLI_PAGE_RETRY_DELAY
    delete process.env.POLI_PAGE_TIMEOUT
  })
  afterEach(() => {
    process.env = { ...originalEnv }
    warn.mockRestore()
  })

  it('reads apiKey from POLI_PAGE_API_KEY by default', () => {
    process.env.POLI_PAGE_API_KEY = SANDBOX_KEY
    createPoliPageClient()
    expect(PoliPageMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: SANDBOX_KEY }))
  })

  it('uses explicit options over env', () => {
    process.env.POLI_PAGE_API_KEY = sandboxKey('e')
    createPoliPageClient({ apiKey: sandboxKey('f') })
    expect(PoliPageMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: sandboxKey('f') }))
  })

  it('throws when apiKey is missing', () => {
    expect(() => createPoliPageClient()).toThrowError(/POLI_PAGE_API_KEY/)
  })

  it('throws when POLI_PAGE_API_KEY is empty', () => {
    process.env.POLI_PAGE_API_KEY = ''
    expect(() => createPoliPageClient()).toThrowError(/POLI_PAGE_API_KEY/)
  })

  it('throws when an explicit apiKey is empty and the env var is unset', () => {
    expect(() => createPoliPageClient({ apiKey: '' })).toThrowError(/apiKey is required/)
  })

  it.each([
    SANDBOX_KEY,
    `pp_live_${SECRET}`,
    `pp_eu-prod_${SECRET}`,
  ])('accepts a well-formed key with no warning: %s', key => {
    createPoliPageClient({ apiKey: key })
    expect(PoliPageMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: key }))
    expect(warn).not.toHaveBeenCalled()
  })

  it.each([
    ['a too-short secret', 'pp_sandbox_x', 'pp_sandbox_'],
    ['a hyphenated environment', 'pp_eu-prod_x', 'pp_eu-prod_'],
    ['a 20-character environment', `pp_${'a'.repeat(20)}_x`, `pp_${'a'.repeat(20)}_`],
    // `{env}` outside the contract grammar may be secret material: no key text.
    ['secret-like characters in the environment slot', 'pp_0123456789abcdef0123_rest', ''],
    ['an uppercase environment', `pp_Sandbox_${SECRET}`, ''],
    ['an environment starting with a digit', `pp_2fa_${SECRET}`, ''],
    ['a doubled hyphen', `pp_a--b_${SECRET}`, ''],
    ['a leading hyphen', `pp_-eu_${SECRET}`, ''],
    ['a trailing hyphen', `pp_eu-_${SECRET}`, ''],
    ['a 21-character environment', `pp_${'a'.repeat(21)}_${SECRET}`, ''],
    ['a non-pp_ token', `dash_tok_${SECRET}`, ''],
  ])('builds a client and warns once for %s', (_label, key, shownPrefix) => {
    createPoliPageClient({ apiKey: key })
    createPoliPageClient({ apiKey: key })
    expect(PoliPageMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: key }))
    expect(warn).toHaveBeenCalledTimes(1)
    const message = String(warn.mock.calls[0]?.[0])
    expect(message).not.toContain(SECRET)
    expect(message).not.toContain(key)
    expect(message).toContain(`"${shownPrefix}…"`)
  })

  it('does not leak the secret of a malformed key read from the env', () => {
    process.env.POLI_PAGE_API_KEY = 'pp_sandbox_x'
    createPoliPageClient()
    createPoliPageClient()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('pp_sandbox_')
    expect(String(warn.mock.calls[0]?.[0])).not.toContain('pp_sandbox_x')
  })

  it('warns once per distinct malformed key', () => {
    createPoliPageClient({ apiKey: 'pp_sandbox_x' })
    createPoliPageClient({ apiKey: 'pp_sandbox_y' })
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('memoises no-arg calls', () => {
    process.env.POLI_PAGE_API_KEY = sandboxKey('a')
    const a = createPoliPageClient()
    const b = createPoliPageClient()
    expect(a).toBe(b)
    expect(PoliPageMock).toHaveBeenCalledTimes(1)
  })

  it('bypasses memo when options are passed', () => {
    process.env.POLI_PAGE_API_KEY = sandboxKey('a')
    const a = createPoliPageClient()
    const b = createPoliPageClient({ apiKey: sandboxKey('b') })
    expect(a).not.toBe(b)
    expect(PoliPageMock).toHaveBeenCalledTimes(2)
  })

  it('memoises per-apiKey when reading env', () => {
    process.env.POLI_PAGE_API_KEY = sandboxKey('1')
    const a = createPoliPageClient()
    process.env.POLI_PAGE_API_KEY = sandboxKey('2')
    const b = createPoliPageClient()
    expect(a).not.toBe(b)
    expect(PoliPageMock).toHaveBeenCalledTimes(2)
  })

  it('forwards optional fields (baseUrl, timeout, retries) and listeners', () => {
    const onRequest = vi.fn()
    createPoliPageClient({
      apiKey: SANDBOX_KEY,
      baseUrl: 'https://api.example.com',
      timeout: 12_000,
      maxRetries: 5,
      retryDelay: 200,
      onRequest,
    })
    expect(PoliPageMock).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: SANDBOX_KEY,
      baseUrl: 'https://api.example.com',
      timeout: 12_000,
      maxRetries: 5,
      retryDelay: 200,
      onRequest,
    }))
  })

  it('reads numeric overrides from env when no explicit option is passed', () => {
    process.env.POLI_PAGE_API_KEY = SANDBOX_KEY
    process.env.POLI_PAGE_MAX_RETRIES = '7'
    process.env.POLI_PAGE_RETRY_DELAY = '250'
    process.env.POLI_PAGE_TIMEOUT = '15000'
    process.env.POLI_PAGE_BASE_URL = 'https://api.example.com'
    createPoliPageClient()
    expect(PoliPageMock).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: SANDBOX_KEY,
      maxRetries: 7,
      retryDelay: 250,
      timeout: 15_000,
      baseUrl: 'https://api.example.com',
    }))
  })

  it('ignores invalid numeric env values', () => {
    process.env.POLI_PAGE_API_KEY = SANDBOX_KEY
    process.env.POLI_PAGE_MAX_RETRIES = 'oops'
    process.env.POLI_PAGE_TIMEOUT = '-3'
    createPoliPageClient()
    const call = PoliPageMock.mock.calls[0]?.[0]
    expect(call?.maxRetries).toBeUndefined()
    expect(call?.timeout).toBeUndefined()
  })
})
