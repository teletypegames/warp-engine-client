import type { StoreConfiguration } from '../../domain/models/StoreConfiguration'
import {
  WARP_ENGINE_VERSION_HEADER, describeWarpEngineVersion, readWarpEngineVersion,
  type WarpEngineVersion
} from '../../domain/models/WarpEngineVersion'
import { describeError } from '../../domain/errors/DescribeError'
import type { StoreFileSystem } from '../files/StoreFileSystem'
import { StoreHttpClient } from '../http/StoreHttpClient'
import { asRecord, readNumber, type JsonRecord } from '../json/JsonRecord'
import type { CatalogPageProgress } from '../../domain/models/CatalogPage'

const CLIENT_VERSION = '3.0.0'

const IMAGE_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif'
}

export interface DownloadedImage {
  readonly body: Buffer
  readonly extension: string
}

/** A catalog, and which engine served it. */
export interface FetchedCatalog {
  readonly catalog: unknown
  readonly engineVersion: WarpEngineVersion
}

/**
 * Called after every page with the catalog as read so far — the same shape the
 * complete catalog has, so a dialect can read it early — and the engine version, which
 * the first page's header already told.
 */
export type CatalogPageListener = (
  progress: CatalogPageProgress,
  catalogSoFar: unknown,
  engineVersion: WarpEngineVersion
) => void

/** The paging fields of an API-2 envelope; null where the engine sent a plain list. */
interface CatalogEnvelope {
  readonly api: number
  readonly page: number
  readonly totalPages: number
  readonly total: number
  readonly nextPage: number | null
}

/**
 * The catalog API, as this store talks to it.
 *
 * Every URL the store fetches is built here, and the catalog is cached next to the
 * config so a sync survives an outage — the machine that lost its network still has
 * a library, and being told what is installed matters more than being current.
 */
export class CatalogClient {
  public readonly http: StoreHttpClient

  public constructor (
    private readonly configuration: StoreConfiguration,
    private readonly files: StoreFileSystem,
    private readonly cachePath: string,
    private readonly log: (line: string) => void,
    /**
     * The bearer token to send, asked for per request rather than held.
     *
     * Every call this client makes goes to the catalog's own host, so the credential
     * belongs on all of them: the catalog needs it to say what this person owns, and
     * the download needs it to be allowed at all.
     */
    bearerToken: () => string | null = (): null => null
  ) {
    this.http = new StoreHttpClient({
      userAgent: `warp-engine-client/${CLIENT_VERSION} (${configuration.store.id})`,
      timeout: configuration.behavior.timeout,
      insecure: configuration.behavior.insecure,
      bearerToken
    })
  }

  /** The same HTTP client, for the service descriptor and the sign-in flow. */

  public resolveApiUrl (endpoint: 'catalog' | 'download', parameters?: Readonly<Record<string, string>>): string {
    const { baseUrl, api } = this.configuration.store
    const url = `${baseUrl}/${api[endpoint].replace(/^\/+/, '')}`
    if (parameters === undefined) return url
    return `${url}?${new URLSearchParams(parameters).toString()}`
  }

  /** `GET /api/download` rather than `/file/`, so downloads are counted. */
  public resolveDownloadUrl (asset: string): string {
    return this.resolveApiUrl('download', { path: asset })
  }

  /**
   * The catalog, and the version of the engine that served it.
   *
   * WarpEngine 0.13 pages the catalog: the first request asks for page 1, and an
   * envelope with `api` and `nextPage` means there is more to fetch. Every page is
   * reported through `onPage` with the catalog stitched together so far, so a window can
   * draw while the rest is in flight. An older engine ignores `page` and answers with
   * the whole list, which is a catalog of one page. What lands in the cache is always
   * the complete, stitched catalog — the format the shell engine wrote, never a partial
   * one — and a fetch that fails halfway leaves the previous cache alone.
   *
   * The version comes from the response header, so it costs no extra request. A cache
   * hit has no header — the cache file holds the catalog exactly as the engine sent it —
   * and then the version is reported as absent, which resolves to the oldest dialect
   * this client knows.
   */
  public async fetchCatalog (onPage?: CatalogPageListener): Promise<FetchedCatalog> {
    const firstUrl = this.resolvePageUrl(1)
    try {
      const first = await this.readPage(firstUrl)
      const engineVersion = readWarpEngineVersion(first.headers[WARP_ENGINE_VERSION_HEADER] ?? null)
      const sentence = describeWarpEngineVersion(engineVersion)
      if (engineVersion.supported) this.log(sentence)
      else this.log(`warning: ${sentence}`)

      const envelope = readEnvelope(first.record)
      if (envelope === null) {
        this.files.writeJson(this.cachePath, first.record)
        return { catalog: first.record, engineVersion }
      }

      let softwares = readSoftwares(first.record)
      onPage?.(toProgress(envelope, softwares.length), stitch(first.record, softwares), engineVersion)
      let next = envelope.nextPage
      while (next !== null) {
        const page = await this.readPage(this.resolvePageUrl(next))
        const pageEnvelope = readEnvelope(page.record)
        softwares = [...softwares, ...readSoftwares(page.record)]
        if (pageEnvelope === null) break
        onPage?.(toProgress(pageEnvelope, softwares.length), stitch(first.record, softwares), engineVersion)
        next = pageEnvelope.nextPage
      }
      if (envelope.totalPages > 1) {
        this.log(`catalog: ${String(softwares.length)} titles over ${String(envelope.totalPages)} pages`)
      }

      const catalog = stitch(first.record, softwares)
      this.files.writeJson(this.cachePath, catalog)
      return { catalog, engineVersion }
    } catch (error: unknown) {
      const cached = asRecord(this.files.readJson(this.cachePath))
      if (cached === null) throw new Error(`cannot fetch the catalog from ${firstUrl}: ${describeError(error)}`)
      this.log(`warning: catalog fetch failed (${describeError(error)}) — using the cached copy`)
      return { catalog: cached, engineVersion: readWarpEngineVersion(null) }
    }
  }

  private resolvePageUrl (page: number): string {
    const ownerId = this.configuration.catalog.ownerId
    return this.resolveApiUrl('catalog', {
      ...(ownerId === null ? {} : { owner_id: String(ownerId) }),
      page: String(page)
    })
  }

  private async readPage (url: string): Promise<{ record: JsonRecord, headers: Readonly<Record<string, string>> }> {
    const { body, headers } = await this.http.readBytes(url)
    const record = asRecord(JSON.parse(body.toString('utf8')))
    if (record === null) throw new Error('the catalog is not a JSON object')
    return { record, headers }
  }

  public async downloadAsset (asset: string, destination: string): Promise<number> {
    return await this.http.download(this.resolveDownloadUrl(asset), destination)
  }

  /**
   * Box art, or null if it cannot be had.
   *
   * Missing box art is not a reason to fail an install: the menu entry gets the
   * generic icon and the game still starts.
   */
  public async downloadImage (imageUrl: string, name: string): Promise<DownloadedImage | null> {
    try {
      const { body, contentType } = await this.http.readBytes(this.resolveImageUrl(imageUrl))
      const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
      return { body, extension: IMAGE_EXTENSIONS[mediaType] ?? '.png' }
    } catch (error: unknown) {
      this.log(`warning: box art for ${name} failed: ${describeError(error)}`)
      return null
    }
  }

  /** The catalog gives a server-relative `imageUrl`; absolute ones pass through. */
  public resolveImageUrl (imageUrl: string): string {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl
    return this.configuration.store.baseUrl + imageUrl
  }
}

/** The paging fields, or null where there is no `api` version — a plain, unpaged list. */
function readEnvelope (record: JsonRecord): CatalogEnvelope | null {
  if (typeof record['api'] !== 'number') return null
  const page = readNumber(record, 'page', 1)
  const next: unknown = record['nextPage']
  return {
    api: readNumber(record, 'api', 0),
    page,
    totalPages: Math.max(readNumber(record, 'totalPages', 1), 1),
    total: readNumber(record, 'total', 0),
    // Only a page past this one counts as next: a server that pointed back at the
    // same page would otherwise be read forever.
    nextPage: typeof next === 'number' && next > page ? next : null
  }
}

function readSoftwares (record: JsonRecord): readonly unknown[] {
  const softwares: unknown = record['softwares']
  return Array.isArray(softwares) ? softwares : []
}

/** The first page's envelope around every title read so far: one page holding them all. */
function stitch (first: JsonRecord, softwares: readonly unknown[]): JsonRecord {
  return { ...first, page: 1, perPage: softwares.length, totalPages: 1, nextPage: null, softwares }
}

function toProgress (envelope: CatalogEnvelope, loaded: number): CatalogPageProgress {
  return {
    page: envelope.page,
    totalPages: envelope.totalPages,
    loaded,
    total: Math.max(envelope.total, loaded)
  }
}
