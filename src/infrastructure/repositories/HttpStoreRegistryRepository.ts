import { RegistryUnavailableError } from '../../domain/errors/RegistryUnavailableError'
import type { RegistryStore } from '../../domain/models/RegistryStore'
import type { StoreRegistryRepository } from '../../domain/ports/StoreRegistryRepository'
import { asRecord, readString, type JsonRecord } from '../json/JsonRecord'
import type { BuildConfiguration } from '../config/BuildConfiguration'
import type { HttpTextClient } from '../http/HttpTextClient'

const DEFAULT_REGISTRY_URL = 'https://teletypegames.org/api/stores'

/**
 * The registry: `GET /api/stores` on the site.
 *
 * The one address this client knows, and it is decided in three places, most specific
 * first: a runtime `STORES_API` (for trying something out), the `warpEngine.registryUrl`
 * field a build was packaged with (for shipping a client for another site), and finally
 * the address of ours.
 *
 * A name and a catalog URL make a store, and are all a record carries. Anything else it
 * happens to say is ignored: how a store behaves is this client's own business, decided
 * by the engine it ships with. Records missing either field are dropped rather than
 * half-used.
 */
export class HttpStoreRegistryRepository implements StoreRegistryRepository {
  public readonly sourceUrl: string

  public constructor (
    private readonly httpClient: HttpTextClient,
    buildConfiguration: BuildConfiguration,
    sourceUrl?: string
  ) {
    const fromEnvironment = process.env['STORES_API']
    this.sourceUrl = sourceUrl
      ?? (fromEnvironment !== undefined && fromEnvironment.length > 0 ? fromEnvironment : null)
      ?? buildConfiguration.readRegistryUrl()
      ?? DEFAULT_REGISTRY_URL
  }

  public async listStores (): Promise<readonly RegistryStore[]> {
    const body = await this.httpClient.readText(this.sourceUrl)
    const parsed: unknown = JSON.parse(body)
    if (!Array.isArray(parsed)) {
      throw new RegistryUnavailableError(this.sourceUrl, 'the answer was not a list of stores')
    }
    return parsed
      .map((row: unknown): JsonRecord | null => asRecord(row))
      .filter((row: JsonRecord | null): row is JsonRecord => row !== null)
      // Both spellings, because a registry is someone else's API: ours answers
      // camelCase, and a hand-rolled one may not.
      .map((row: JsonRecord): RegistryStore => ({
        name: readString(row, 'name').trim(),
        catalogUrl: (readString(row, 'catalogUrl') || readString(row, 'catalog_url')).trim()
      }))
      .filter((store: RegistryStore): boolean =>
        store.name.length > 0 && store.catalogUrl.length > 0)
  }
}
