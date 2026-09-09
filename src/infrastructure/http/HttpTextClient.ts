import http from 'node:http'
import https from 'node:https'
import { HttpStatusError } from './HttpStatusError'

const REQUEST_TIMEOUT_MS = 60_000
const MAX_REDIRECTS = 5
const USER_AGENT = 'warp-engine-client'

/**
 * GET a URL as text, following redirects.
 *
 * Node's own client rather than `fetch`, because this runs in the main process
 * where the proxy and certificate settings are the system's, and because a moved
 * repository answers 301.
 */
export class HttpTextClient {
  public async readText (url: string, redirectsLeft: number = MAX_REDIRECTS): Promise<string> {
    return new Promise<string>((resolve: (body: string) => void, reject: (error: Error) => void): void => {
      const client = url.startsWith('http://') ? http : https
      const request = client.get(url, { headers: { 'User-Agent': USER_AGENT } }, (response: http.IncomingMessage): void => {
        const status = response.statusCode ?? 0
        const location = response.headers.location

        if (status >= 300 && status < 400 && location !== undefined) {
          response.resume()
          if (redirectsLeft <= 0) {
            reject(new Error(`too many redirects for ${url}`))
            return
          }
          const next = new URL(location, url).toString()
          this.readText(next, redirectsLeft - 1).then(resolve, reject)
          return
        }

        if (status !== 200) {
          response.resume()
          reject(new HttpStatusError(url, status))
          return
        }

        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk: string): void => { body += chunk })
        response.on('end', (): void => { resolve(body) })
      })

      request.setTimeout(REQUEST_TIMEOUT_MS, (): void => {
        request.destroy(new Error(`${url} timed out`))
      })
      request.on('error', reject)
    })
  }
}
