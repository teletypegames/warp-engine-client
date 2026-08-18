import type { EngineVersionDto } from './EngineVersionDto'
import type { InstalledStoreDto } from './InstalledStoreDto'

/** The answer to a store switch: which store is open, and can it be driven. */
export interface StoreSelectionDto {
  readonly store: InstalledStoreDto
  readonly engine: EngineVersionDto | null
}
