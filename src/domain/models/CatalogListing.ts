import type { Game } from './Game'
import type { StorePaths } from './StorePaths'

/** One reading of a store's catalog. */
export interface CatalogListing {
  readonly games: readonly Game[]
  readonly skipped: readonly string[]
  readonly paths: StorePaths | null
}
