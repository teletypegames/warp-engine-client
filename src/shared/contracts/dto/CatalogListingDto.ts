import type { AccountDto } from './AccountDto'
import type { GameDto } from './GameDto'
import type { StorePathsDto } from './StorePathsDto'

/** One `listGames` answer: what the catalog offers, and what was left out. */
export interface CatalogListingDto {
  readonly games: readonly GameDto[]
  readonly skipped: readonly string[]
  readonly paths: StorePathsDto | null
  /**
   * Where this machine stood with the store when the catalog was read.
   *
   * Carried with the listing rather than asked for separately, because the entitlement
   * each entry reports is only meaningful next to whether anybody was signed in when
   * the catalog answered.
   */
  readonly account: AccountDto
}
