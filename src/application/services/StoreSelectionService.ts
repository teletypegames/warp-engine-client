import { StoreMissingError } from '../../domain/errors/StoreMissingError'
import type { EngineVersion } from '../../domain/models/EngineVersion'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import type { InstalledStoreRepository } from '../../domain/ports/InstalledStoreRepository'
import type { StoreCatalogGateway } from '../../domain/ports/StoreCatalogGateway'
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
    private readonly catalogGateway: StoreCatalogGateway,
    private readonly preferences: PreferencesService
  ) {}

  public listStores (): readonly InstalledStore[] {
    return this.stores.findAll()
  }

  /** The store to drive, remembering the choice across runs. Null when there is none. */
  public findCurrentStore (): InstalledStore | null {
    const known = this.stores.findAll()
    const preferredHome = this.preferences.readStoreHome()
    const remembered = preferredHome === null
      ? undefined
      : known.find((store: InstalledStore): boolean => store.home === preferredHome)
    this.current = remembered ?? known[0] ?? null
    return this.current
  }

  public requireCurrentStore (): InstalledStore {
    const store = this.current ?? this.findCurrentStore()
    if (store === null) throw new StoreMissingError()
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
   * The engine version of a store, checked per store rather than once: two stores
   * on one machine can be at different versions, and the one being switched to may
   * be the older one.
   */
  public findEngineVersion (store: InstalledStore): EngineVersion | null {
    return this.catalogGateway.readEngineVersion(store)
  }

  public readDefaultStoreRoot (): string {
    return this.stores.readRoots()[0] ?? ''
  }
}
