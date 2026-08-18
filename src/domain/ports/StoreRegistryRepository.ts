import type { RegistryStore } from '../models/RegistryStore'

/** Which stores exist at all — the site's answer, not this client's. */
export interface StoreRegistryRepository {
  readonly sourceUrl: string
  listStores: () => Promise<readonly RegistryStore[]>
}
