import type { InstalledStoreDto } from './InstalledStoreDto'

/** The answer to a store switch: which store is now open. */
export interface StoreSelectionDto {
  readonly store: InstalledStoreDto
}
