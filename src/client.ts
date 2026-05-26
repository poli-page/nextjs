import { PoliPage } from '@poli-page/sdk'
import type {
  PoliPageError,
  PoliPageOptions,
  RequestEvent,
  ResponseEvent,
  RetryEvent,
} from '@poli-page/sdk'

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
  const baseUrl = options.baseUrl ?? process.env.POLI_PAGE_BASE_URL
  const maxRetries = options.maxRetries ?? parsePositiveInt(process.env.POLI_PAGE_MAX_RETRIES)
  const retryDelay = options.retryDelay ?? parsePositiveInt(process.env.POLI_PAGE_RETRY_DELAY)
  const timeout = options.timeout ?? parsePositiveInt(process.env.POLI_PAGE_TIMEOUT)

  const sdkOptions: PoliPageOptions = { apiKey }
  if (baseUrl !== undefined) sdkOptions.baseUrl = baseUrl
  if (maxRetries !== undefined) sdkOptions.maxRetries = maxRetries
  if (retryDelay !== undefined) sdkOptions.retryDelay = retryDelay
  if (timeout !== undefined) sdkOptions.timeout = timeout
  if (options.onRequest !== undefined) sdkOptions.onRequest = options.onRequest
  if (options.onResponse !== undefined) sdkOptions.onResponse = options.onResponse
  if (options.onRetry !== undefined) sdkOptions.onRetry = options.onRetry
  if (options.onError !== undefined) sdkOptions.onError = options.onError

  return new PoliPage(sdkOptions)
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** @internal — tests only. Do not use in application code. */
export function __resetMemoForTests(): void {
  memo.clear()
}
