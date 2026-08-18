import type { StoreConfiguration } from '../../domain/models/StoreConfiguration'
import {
  WARP_ENGINE_VERSION_HEADER, describeWarpEngineVersion, readWarpEngineVersion,
  type WarpEngineVersion
} from '../../domain/models/WarpEngineVersion'
import { describe, type StoreFileSystem } from '../files/StoreFileSystem'
import { StoreHttpClient } from '../http/StoreHttpClient'
import { asRecord } from '../json/JsonRecord'

const CLIENT_VERSION = '2.0.0'

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
 * The catalog API, as this store talks to it.
 *
 * Every URL the store fetches is built here, and the catalog is cached next to the
 * config so a sync survives an outage — the machine that lost its network still has
 * a library, and being told what is installed matters more than being current.
 */
export class CatalogClient {
  private readonly http: StoreHttpClient

  public constructor (
    private readonly configuration: StoreConfiguration,
    private readonly files: StoreFileSystem,
    private readonly cachePath: string,
    private readonly log: (line: string) => void
  ) {
    this.http = new StoreHttpClient({
      userAgent: `warp-engine-client/${CLIENT_VERSION} (${configuration.store.id})`,
      timeout: configuration.behavior.timeout,
      insecure: configuration.behavior.insecure
    })
  }

  public apiUrl (endpoint: 'catalog' | 'download', parameters?: Readonly<Record<string, string>>): string {
    const { baseUrl, api } = this.configuration.store
    const url = `${baseUrl}/${api[endpoint].replace(/^\/+/, '')}`
    if (parameters === undefined) return url
    return `${url}?${new URLSearchParams(parameters).toString()}`
  }

  /** `GET /api/download` rather than `/file/`, so downloads are counted. */
  public downloadUrl (asset: string): string {
    return this.apiUrl('download', { path: asset })
  }

  /**
   * The catalog, and the version of the engine that served it.
   *
   * The version comes from the response header, so it costs no extra request. A cache
   * hit has no header — the cache file holds the catalog exactly as the engine sent it,
   * which is the format the shell engine wrote and worth keeping — and then the version
   * is reported as absent, which resolves to the oldest dialect this client knows.
   */
  public async fetchCatalog (): Promise<FetchedCatalog> {
    const ownerId = this.configuration.catalog.ownerId
    const url = this.apiUrl('catalog', ownerId === null ? undefined : { owner_id: String(ownerId) })
    try {
      const { body, headers } = await this.http.readBytes(url)
      const catalog = asRecord(JSON.parse(body.toString('utf8')))
      if (catalog === null) throw new Error('the catalog is not a JSON object')
      this.files.writeJson(this.cachePath, catalog)

      const engineVersion = readWarpEngineVersion(headers[WARP_ENGINE_VERSION_HEADER] ?? null)
      const sentence = describeWarpEngineVersion(engineVersion)
      if (engineVersion.supported) this.log(sentence)
      else this.log(`warning: ${sentence}`)
      return { catalog, engineVersion }
    } catch (error: unknown) {
      const cached = asRecord(this.files.readJson(this.cachePath))
      if (cached === null) throw new Error(`cannot fetch the catalog from ${url}: ${describe(error)}`)
      this.log(`warning: catalog fetch failed (${describe(error)}) — using the cached copy`)
      return { catalog: cached, engineVersion: readWarpEngineVersion(null) }
    }
  }

  public async downloadAsset (asset: string, destination: string): Promise<number> {
    return await this.http.download(this.downloadUrl(asset), destination)
  }

  /**
   * Box art, or null if it cannot be had.
   *
   * Missing box art is not a reason to fail an install: the menu entry gets the
   * generic icon and the game still starts.
   */
  public async downloadImage (imageUrl: string, name: string): Promise<DownloadedImage | null> {
    try {
      const { body, contentType } = await this.http.readBytes(this.absoluteImageUrl(imageUrl))
      const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
      return { body, extension: IMAGE_EXTENSIONS[mediaType] ?? '.png' }
    } catch (error: unknown) {
      this.log(`warning: box art for ${name} failed: ${describe(error)}`)
      return null
    }
  }

  /** The catalog gives a server-relative `imageUrl`; absolute ones pass through. */
  public absoluteImageUrl (imageUrl: string): string {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl
    return this.configuration.store.baseUrl + imageUrl
  }
}
