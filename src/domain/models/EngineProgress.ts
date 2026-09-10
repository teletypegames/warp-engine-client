import type { SyncEventDto } from '../../shared/contracts/dto/SyncEventDto'
import type { CatalogListing } from './CatalogListing'
import type { CatalogPageProgress } from './CatalogPage'

/**
 * How a long-running engine call reports itself.
 *
 * `onLog` is a line a person can read (the engine's stderr), `onEvent` one of its
 * JSON progress events. Both are optional: a caller that only wants the result
 * passes neither.
 */
export interface EngineProgressListener {
  readonly onLog?: (line: string) => void
  readonly onEvent?: (event: SyncEventDto) => void
  /**
   * A page of the catalog has arrived, and this is the listing as far as it goes.
   *
   * Every page is followed by a listing built from everything read so far, so a window
   * can draw while the rest is still in flight; the final, complete listing is what the
   * call itself returns.
   */
  readonly onCatalogPage?: (progress: CatalogPageProgress, listing: CatalogListing) => void
}
