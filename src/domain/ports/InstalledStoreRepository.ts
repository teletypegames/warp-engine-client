import type { InstalledStore } from '../models/InstalledStore'

/** The stores present on this machine, wherever the shell installer would put them. */
export interface InstalledStoreRepository {
  findAll: () => readonly InstalledStore[]
  findByHome: (home: string) => InstalledStore | null
  /** The roots that are searched, in the order the shell installer would use them. */
  readRoots: () => readonly string[]
  resolveDefaultHome: (storeId: string) => string
  /**
   * Delete a store home. Only a directory this repository would have *found* is
   * accepted, so a caller cannot name an arbitrary path and have it removed.
   */
  removeHome: (home: string) => void
}
