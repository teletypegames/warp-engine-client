import { RegistryUnavailableError } from '../../domain/errors/RegistryUnavailableError'
import type { RegistryStore } from '../../domain/models/RegistryStore'
import type { StoreRegistryRepository } from '../../domain/ports/StoreRegistryRepository'
import { asRecord, readString, type JsonRecord } from '../json/JsonRecord'
import { BuildConfiguration } from '../config/BuildConfiguration'
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
 * A record needs a name and a catalog URL; those two make a store. The repository
 * is optional and arrives as null when absent — a store configured by nothing but
 * this record installs on the engine's defaults. Records missing either of the two
 * required fields are dropped rather than half-used.
 */
export class HttpStoreRegistryRepository implements StoreRegistryRepository {
  public readonly sourceUrl: string

  public constructor (
    private readonly httpClient: HttpTextClient,
    sourceUrl?: string,
    buildConfiguration: BuildConfiguration = new BuildConfiguration()
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
      .map((row: JsonRecord): RegistryStore => {
        // Both spellings, because a registry is someone else's API: ours answers
        // camelCase, and a hand-rolled one may not.
        const repository = (
          readString(row, 'storeRepositoryUrl') || readString(row, 'store_repository_url')
        ).trim()
        return {
          name: readString(row, 'name').trim(),
          catalogUrl: (readString(row, 'catalogUrl') || readString(row, 'catalog_url')).trim(),
          storeRepositoryUrl: repository.length > 0 ? repository : null
        }
      })
      .filter((store: RegistryStore): boolean =>
        store.name.length > 0 && store.catalogUrl.length > 0)
  }
}
