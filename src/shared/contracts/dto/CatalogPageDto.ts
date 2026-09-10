import type { CatalogListingDto } from './CatalogListingDto'

/** One page of the catalog has arrived: how far the read has got, and the listing so far. */
export interface CatalogPageDto {
  readonly page: number
  readonly totalPages: number
  readonly loaded: number
  readonly total: number
  readonly listing: CatalogListingDto
}
