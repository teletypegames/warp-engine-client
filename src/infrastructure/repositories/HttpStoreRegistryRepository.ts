import { RegistryUnavailableError } from '../../domain/errors/RegistryUnavailableError'
import type { RegistryStore } from '../../domain/models/RegistryStore'
import type { StoreRegistryRepository } from '../../domain/ports/StoreRegistryRepository'
import { asRecord, readString, type JsonRecord } from '../json/JsonRecord'
import type { HttpTextClient } from '../http/HttpTextClient'

const DEFAULT_REGISTRY_URL = 'https://teletypegames.org/api/stores'

/**
 * The registry: `GET /api/stores` on the site.
 *
 * The one address this client knows, and even that is overridable — `STORES_API`
 * points it at another site or at a local endpoint.
 *
 * A record needs a name and a catalog URL; those two make a store. The repository
 * is optional and arrives as null when absent — a store configured by nothing but
 * this record installs on the engine's defaults. Records missing either of the two
 * required fields are dropped rather than half-used.
 */
export class HttpStoreRegistryRepository implements StoreRegistryRepository {
  public readonly sourceUrl: string

  public constructor (private readonly httpClient: HttpTextClient, sourceUrl?: string) {
    const configured = process.env['STORES_API']
    this.sourceUrl = sourceUrl ?? (configured !== undefined && configured.length > 0
      ? configured
      : DEFAULT_REGISTRY_URL)
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
