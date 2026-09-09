import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { HttpStatusError } from './HttpStatusError'

const MAX_REDIRECTS = 5

export interface HttpResponseBody {
  readonly body: Buffer
  readonly contentType: string
  /** Lower-cased names, as Node delivers them. The engine version arrives in one. */
  readonly headers: Readonly<Record<string, string>>
  readonly statusCode: number
}

export interface StoreHttpOptions {
  readonly userAgent: string
  /** Seconds, as the store config states it. */
  readonly timeout: number
  readonly insecure: boolean
  /**
   * The bearer token to send, asked for per request.
   *
   * A function rather than a value because the token changes under a long-lived
   * client — signing in and out do not rebuild it — and because there is no reason
   * to hold the secret in a field that outlives the request that needs it.
   */
  readonly bearerToken?: () => string | null
}

interface RequestOptions {
  readonly method?: string
  readonly body?: string
  readonly contentType?: string
  /** Statuses to hand back rather than throw on. */
  readonly accept?: readonly number[]
}

/**
 * The store's own HTTP: bytes rather than text, and a streaming download.
 *
 * Separate from `HttpTextClient` because the two have different jobs — that one
 * fetches a config file and wants a string, this one fetches a catalog and a
 * multi-megabyte archive and must not hold the archive in memory. It also honours
 * the store config's `timeout` and `insecure`, which are per-store settings rather
 * than properties of this application.
 */
export class StoreHttpClient {
  public constructor (private readonly options: StoreHttpOptions) {}

  public async readBytes (url: string, request: RequestOptions = {}): Promise<HttpResponseBody> {
    return await this.request(url, MAX_REDIRECTS, request, async (
      response: http.IncomingMessage
    ): Promise<HttpResponseBody> => {
      return {
        body: await readAllBytes(response),
        contentType: response.headers['content-type'] ?? '',
        headers: readHeaders(response),
        statusCode: response.statusCode ?? 0
      }
    })
  }

  /** A JSON request and a JSON answer — the shape every auth endpoint speaks. */
  public async requestJson (
    url: string,
    request: RequestOptions & { readonly payload?: unknown } = {}
  ): Promise<{ readonly json: unknown, readonly statusCode: number }> {
    const { payload, ...rest } = request
    const response = await this.readBytes(url, {
      ...rest,
      ...(payload === undefined
        ? {}
        : { body: JSON.stringify(payload), contentType: 'application/json' })
    })
    const text = response.body.toString('utf8')
    return {
      json: text.trim().length === 0 ? null : JSON.parse(text),
      statusCode: response.statusCode
    }
  }

  /**
   * Stream `url` into `destination` atomically. Returns bytes written.
   *
   * A part file next to the target, then a rename: a download interrupted halfway
   * must not look like a complete archive to the next sync.
   */
  public async download (url: string, destination: string): Promise<number> {
    const directory = path.dirname(destination)
    fs.mkdirSync(directory, { recursive: true })
    const partial = `${destination}.part`
    let written = 0

    try {
      await this.request(url, MAX_REDIRECTS, {}, async (response: http.IncomingMessage): Promise<void> => {
        response.on('data', (chunk: Buffer): void => { written += chunk.length })
        await pipeline(response, fs.createWriteStream(partial))
      })
      if (written === 0) throw new Error(`${url} returned an empty response`)
      fs.renameSync(partial, destination)
    } catch (error: unknown) {
      fs.rmSync(partial, { force: true })
      throw error
    }
    return written
  }

  private async request<TResult> (
    url: string,
    redirectsLeft: number,
    request: RequestOptions,
    consume: (response: http.IncomingMessage) => Promise<TResult>,
    origin: string = originOf(url)
  ): Promise<TResult> {
    const response = await this.open(url, request, origin)
    const status = response.statusCode ?? 0
    const location = response.headers.location

    if (status >= 300 && status < 400 && location !== undefined) {
      response.resume()
      if (redirectsLeft <= 0) throw new Error(`too many redirects for ${url}`)
      const next = new URL(location, url).toString()
      // The origin travels with the redirect chain, not with each hop: a gated
      // download answers 302 to a signed storage URL, and *that* host must not be
      // sent our bearer token. It is somebody else's server, and a presigned URL is
      // refused outright by some object stores when an Authorization header rides
      // along with the signature. A redirect back to the catalog keeps the token,
      // because that is the server that issued it.
      return await this.request(next, redirectsLeft - 1, redirectedRequest(request), consume, origin)
    }
    if (status !== 200 && !(request.accept ?? []).includes(status)) {
      response.resume()
      throw new HttpStatusError(url, status)
    }
    return await consume(response)
  }

  private async open (
    url: string,
    request: RequestOptions,
    origin: string
  ): Promise<http.IncomingMessage> {
    return new Promise<http.IncomingMessage>((
      resolve: (response: http.IncomingMessage) => void,
      reject: (error: Error) => void
    ): void => {
      const secure = !url.startsWith('http://')
      const client = secure ? https : http
      const outgoing = client.request(url, {
        method: request.method ?? 'GET',
        headers: this.buildHeaders(url, request, origin),
        ...(secure && this.options.insecure ? { rejectUnauthorized: false } : {})
      }, resolve)

      outgoing.setTimeout(Math.max(1, this.options.timeout) * 1000, (): void => {
        outgoing.destroy(new Error(`${url} timed out`))
      })
      outgoing.on('error', reject)
      if (request.body !== undefined) outgoing.write(request.body)
      outgoing.end()
    })
  }

  private buildHeaders (
    url: string,
    request: RequestOptions,
    origin: string
  ): Record<string, string> {
    const headers: Record<string, string> = { 'User-Agent': this.options.userAgent }
    if (request.contentType !== undefined) headers['Content-Type'] = request.contentType
    if (request.body !== undefined) {
      headers['Content-Length'] = String(Buffer.byteLength(request.body))
    }

    const token = originOf(url) === origin ? this.options.bearerToken?.() ?? null : null
    if (token !== null && token.length > 0) headers['Authorization'] = `Bearer ${token}`
    return headers
  }
}

/**
 * A redirect is followed as a GET without the body.
 *
 * That is what every client does with 301/302 after a POST, and what the servers
 * answering them expect. `accept` travels on, because it describes what the caller
 * is willing to read rather than anything about one hop.
 */
function redirectedRequest (request: RequestOptions): RequestOptions {
  return request.accept === undefined ? {} : { accept: request.accept }
}

function originOf (url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

/**
 * The response headers as plain strings.
 *
 * Node gives a repeated header as an array; the ones this client reads are single-valued,
 * and joining is a truer answer than picking the first.
 */
function readHeaders (response: http.IncomingMessage): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(response.headers)) {
    if (value === undefined) continue
    headers[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value
  }
  return headers
}

/**
 * The whole body, as bytes.
 *
 * Read through the data event rather than the async iterator, whose chunks are typed
 * as anything: a stream in the default mode hands out Buffers, and the check says so
 * rather than a cast assuming it.
 */
function readAllBytes (response: http.IncomingMessage): Promise<Buffer> {
  return new Promise<Buffer>((resolve: (body: Buffer) => void, reject: (error: Error) => void): void => {
    const chunks: Buffer[] = []
    response.on('data', (chunk: unknown): void => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
    })
    response.on('end', (): void => { resolve(Buffer.concat(chunks)) })
    response.on('error', reject)
  })
}

