import type { CatalogListing } from '../models/CatalogListing'
import type { EngineProgressListener } from '../models/EngineProgress'
import type { EngineVersion } from '../models/EngineVersion'
import type { InstalledStore } from '../models/InstalledStore'
import type { StorePaths } from '../models/StorePaths'

/**
 * The store engine, as an interface.
 *
 * Every catalog operation this client performs is one call on this port; the CLI
 * behind it stays the product, and nothing above this line knows it is Python.
 */
export interface StoreCatalogGateway {
  listGames: (store: InstalledStore, progress?: EngineProgressListener) => Promise<CatalogListing>
  readPaths: (store: InstalledStore, progress?: EngineProgressListener) => Promise<StorePaths>
  syncGames: (store: InstalledStore, names: readonly string[], progress?: EngineProgressListener) => Promise<void>
  removeGame: (store: InstalledStore, name: string, progress?: EngineProgressListener) => Promise<void>
  readEngineVersion: (store: InstalledStore) => EngineVersion | null
}
