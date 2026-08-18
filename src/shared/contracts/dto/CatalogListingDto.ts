import type { GameDto } from './GameDto'
import type { StorePathsDto } from './StorePathsDto'

/** One `listGames` answer: what the catalog offers, and what was left out. */
export interface CatalogListingDto {
  readonly games: readonly GameDto[]
  readonly skipped: readonly string[]
  readonly paths: StorePathsDto | null
}
