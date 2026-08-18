import type { CatalogListing } from '../models/CatalogListing'
import type { EngineProgressListener } from '../models/EngineProgress'
import type { InstalledStore } from '../models/InstalledStore'
import type { StorePaths } from '../models/StorePaths'

/**
 * The store engine, as an interface.
 *
 * Every catalog operation this client performs is one call on this port. The engine
 * behind it runs in this process, but nothing above this line knows that either —
 * the port is what let it stop being a child process without a change up here.
 */
export interface StoreCatalogGateway {
  listGames: (store: InstalledStore, progress?: EngineProgressListener) => Promise<CatalogListing>
  readPaths: (store: InstalledStore, progress?: EngineProgressListener) => Promise<StorePaths>
  syncGames: (store: InstalledStore, names: readonly string[], progress?: EngineProgressListener) => Promise<void>
  removeGame: (store: InstalledStore, name: string, progress?: EngineProgressListener) => Promise<void>
}
