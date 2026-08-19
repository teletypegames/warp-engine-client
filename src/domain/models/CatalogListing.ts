import type { Game } from './Game'
import type { StoreAccount } from './StoreAccount'
import type { StorePaths } from './StorePaths'

/** One reading of a store's catalog. */
export interface CatalogListing {
  readonly games: readonly Game[]
  readonly skipped: readonly string[]
  readonly paths: StorePaths | null
  /**
   * Where this machine stands with the store, as of this reading.
   *
   * Part of the listing rather than a call of its own because it is the same answer
   * from the same request: the catalog was fetched with whatever credential we hold,
   * and what it said about entitlements is only meaningful next to whether anybody was
   * signed in when it said it.
   */
  readonly account: StoreAccount
}
