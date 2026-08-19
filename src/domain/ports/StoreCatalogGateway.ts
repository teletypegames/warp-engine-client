import type { CatalogListing } from '../models/CatalogListing'
import type { EngineProgressListener } from '../models/EngineProgress'
import type { InstalledStore } from '../models/InstalledStore'
import type { SignInPrompt, StoreAccount } from '../models/StoreAccount'
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

  /** Whether this store offers a sign-in, and whether we are holding a token for it. */
  readAccount: (store: InstalledStore) => Promise<StoreAccount>
  /**
   * Ask the store for a code pair. The *waiting* is not here: polling is a loop with a
   * cancel in it, which is orchestration, and orchestration belongs above this port.
   */
  requestSignIn: (store: InstalledStore, clientName: string) => Promise<SignInPrompt>
  /** One poll. Returns the account once it is answered, or null while it is not. */
  pollSignIn: (store: InstalledStore, deviceCode: string) => Promise<SignInPollResult>
  signOut: (store: InstalledStore) => Promise<StoreAccount>
}

export interface SignInPollResult {
  readonly state: 'pending' | 'approved' | 'denied' | 'expired'
  readonly account: StoreAccount
}
