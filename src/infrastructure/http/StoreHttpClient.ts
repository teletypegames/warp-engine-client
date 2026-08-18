import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { HttpStatusError } from './HttpTextClient'

const MAX_REDIRECTS = 5

export interface HttpResponseBody {
  readonly body: Buffer
  readonly contentType: string
  /** Lower-cased names, as Node delivers them. The engine version arrives in one. */
  readonly headers: Readonly<Record<string, string>>
}

export interface StoreHttpOptions {
  readonly userAgent: string
  /** Seconds, as the store config states it. */
  readonly timeout: number
  readonly insecure: boolean
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

  public async readBytes (url: string): Promise<HttpResponseBody> {
    return await this.request(url, MAX_REDIRECTS, async (
      response: http.IncomingMessage
    ): Promise<HttpResponseBody> => {
      const chunks: Buffer[] = []
      for await (const chunk of response) chunks.push(Buffer.from(chunk as Buffer))
      return {
        body: Buffer.concat(chunks),
        contentType: response.headers['content-type'] ?? '',
        headers: readHeaders(response)
      }
    })
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
      await this.request(url, MAX_REDIRECTS, async (response: http.IncomingMessage): Promise<void> => {
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
    consume: (response: http.IncomingMessage) => Promise<TResult>
  ): Promise<TResult> {
    const response = await this.open(url)
    const status = response.statusCode ?? 0
    const location = response.headers.location

    if (status >= 300 && status < 400 && location !== undefined) {
      response.resume()
      if (redirectsLeft <= 0) throw new Error(`too many redirects for ${url}`)
      return await this.request(new URL(location, url).toString(), redirectsLeft - 1, consume)
    }
    if (status !== 200) {
      response.resume()
      throw new HttpStatusError(url, status)
    }
    return await consume(response)
  }

  private async open (url: string): Promise<http.IncomingMessage> {
    return new Promise<http.IncomingMessage>((
      resolve: (response: http.IncomingMessage) => void,
      reject: (error: Error) => void
    ): void => {
      const secure = !url.startsWith('http://')
      const client = secure ? https : http
      const request = client.get(url, {
        headers: { 'User-Agent': this.options.userAgent },
        ...(secure && this.options.insecure ? { rejectUnauthorized: false } : {})
      }, resolve)

      request.setTimeout(Math.max(1, this.options.timeout) * 1000, (): void => {
        request.destroy(new Error(`${url} timed out`))
      })
      request.on('error', reject)
    })
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
