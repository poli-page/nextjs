import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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

describe('createPoliPageClient', () => {
  const originalEnv = { ...process.env }
  beforeEach(() => {
    __resetMemoForTests()
    PoliPageMock.mockClear()
    delete process.env.POLI_PAGE_API_KEY
    delete process.env.POLI_PAGE_BASE_URL
    delete process.env.POLI_PAGE_MAX_RETRIES
    delete process.env.POLI_PAGE_RETRY_DELAY
    delete process.env.POLI_PAGE_TIMEOUT
  })
  afterEach(() => { process.env = { ...originalEnv } })

  it('reads apiKey from POLI_PAGE_API_KEY by default', () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_abc'
    createPoliPageClient()
    expect(PoliPageMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'pp_test_abc' }))
  })

  it('uses explicit options over env', () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_from_env'
    createPoliPageClient({ apiKey: 'pp_test_explicit' })
    expect(PoliPageMock).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'pp_test_explicit' }))
  })

  it('throws when apiKey is missing', () => {
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
    expect(PoliPageMock).toHaveBeenCalledTimes(1)
  })

  it('bypasses memo when options are passed', () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_memo'
    const a = createPoliPageClient()
    const b = createPoliPageClient({ apiKey: 'pp_test_other' })
    expect(a).not.toBe(b)
    expect(PoliPageMock).toHaveBeenCalledTimes(2)
  })

  it('memoises per-apiKey when reading env', () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_one'
    const a = createPoliPageClient()
    process.env.POLI_PAGE_API_KEY = 'pp_test_two'
    const b = createPoliPageClient()
    expect(a).not.toBe(b)
    expect(PoliPageMock).toHaveBeenCalledTimes(2)
  })

  it('forwards optional fields (baseUrl, timeout, retries) and listeners', () => {
    const onRequest = vi.fn()
    createPoliPageClient({
      apiKey: 'pp_test_xyz',
      baseUrl: 'https://api-develop.poli.page',
      timeout: 12_000,
      maxRetries: 5,
      retryDelay: 200,
      onRequest,
    })
    expect(PoliPageMock).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'pp_test_xyz',
      baseUrl: 'https://api-develop.poli.page',
      timeout: 12_000,
      maxRetries: 5,
      retryDelay: 200,
      onRequest,
    }))
  })

  it('reads numeric overrides from env when no explicit option is passed', () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_envnum'
    process.env.POLI_PAGE_MAX_RETRIES = '7'
    process.env.POLI_PAGE_RETRY_DELAY = '250'
    process.env.POLI_PAGE_TIMEOUT = '15000'
    process.env.POLI_PAGE_BASE_URL = 'https://api-develop.poli.page'
    createPoliPageClient()
    expect(PoliPageMock).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'pp_test_envnum',
      maxRetries: 7,
      retryDelay: 250,
      timeout: 15_000,
      baseUrl: 'https://api-develop.poli.page',
    }))
  })

  it('ignores invalid numeric env values', () => {
    process.env.POLI_PAGE_API_KEY = 'pp_test_envbad'
    process.env.POLI_PAGE_MAX_RETRIES = 'oops'
    process.env.POLI_PAGE_TIMEOUT = '-3'
    createPoliPageClient()
    const call = PoliPageMock.mock.calls[0]?.[0]
    expect(call?.maxRetries).toBeUndefined()
    expect(call?.timeout).toBeUndefined()
  })
})
