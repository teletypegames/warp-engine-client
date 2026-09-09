import { StoreMissingError } from '../../domain/errors/StoreMissingError'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import type { InstalledStoreRepository } from '../../domain/ports/InstalledStoreRepository'
import type { PreferencesService } from './PreferencesService'

/**
 * Which store is open.
 *
 * A machine can carry several: two catalogs, or the same catalog installed twice.
 * The remembered one wins, so the window reopens where it was left; the current
 * store is cached because every catalog call needs it and re-scanning the disk per
 * call would be silly.
 */
export class StoreSelectionService {
  private current: InstalledStore | null = null

  public constructor (
    private readonly stores: InstalledStoreRepository,
    private readonly preferences: PreferencesService
  ) {}

  public listStores (): readonly InstalledStore[] {
    return this.stores.findAll()
  }

  /**
   * The store to drive, read from the disk and the remembered choice. Null when there
   * is none. A read rather than a find: it refreshes what `requireCurrentStore` answers.
   */
  public readCurrentStore (): InstalledStore | null {
    const known = this.stores.findAll()
    const preferredHome = this.preferences.readStoreHome()
    const remembered = preferredHome === null
      ? undefined
      : known.find((store: InstalledStore): boolean => store.home === preferredHome)
    this.current = remembered ?? known[0] ?? null
    return this.current
  }

  public requireCurrentStore (): InstalledStore {
    const store = this.current ?? this.readCurrentStore()
    if (store === null) throw new StoreMissingError()
    return store
  }

  /** The store at this home, or an error naming it. Does not change what is open. */
  public requireStoreAt (home: string): InstalledStore {
    const store = this.stores.findByHome(home)
    if (store === null) throw new StoreMissingError(home)
    return store
  }

  public selectStore (home: string): InstalledStore {
    const store = this.stores.findByHome(home)
    if (store === null) throw new StoreMissingError(home)
    this.current = store
    this.preferences.updateStoreHome(store.home)
    return store
  }

  /** Adopt a store that was just installed, without a disk scan. */
  public adoptStore (store: InstalledStore): InstalledStore {
    this.current = store
    this.preferences.updateStoreHome(store.home)
    return store
  }

  /**
   * Forget a store that is no longer on the machine.
   *
   * The next store is not chosen here: `readCurrentStore` re-reads the disk and applies
   * the same rule it always does, so "which store is open" has exactly one answer in
   * one place. Clearing the remembered home first is what stops it choosing the one
   * that has just been deleted.
   */
  public forgetStore (store: InstalledStore): void {
    if (this.preferences.readStoreHome() === store.home) this.preferences.forgetStoreHome()
    if (this.current?.home === store.home) this.current = null
    this.readCurrentStore()
  }

  public readDefaultStoreRoot (): string {
    return this.stores.readRoots()[0] ?? ''
  }
}
