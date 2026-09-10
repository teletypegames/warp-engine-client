/**
 * Where a paged catalog read has got to.
 *
 * `loaded` counts titles rather than pages, because that is what a person watching the
 * grid fill can compare with `total`; `page`/`totalPages` are for the log.
 */
export interface CatalogPageProgress {
  readonly page: number
  readonly totalPages: number
  readonly loaded: number
  readonly total: number
}
