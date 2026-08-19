import type { EngineProgressListener } from '../../domain/models/EngineProgress'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import type { RegistryStore } from '../../domain/models/RegistryStore'
import { deriveStoreId } from '../../domain/models/StoreIdentity'
import type { InstalledStoreRepository } from '../../domain/ports/InstalledStoreRepository'
import type { StoreEngineInstaller } from '../../domain/ports/StoreEngineInstaller'
import type { StoreRegistryRepository } from '../../domain/ports/StoreRegistryRepository'
import type { StoreSelectionService } from './StoreSelectionService'

/**
 * Getting a store onto this machine.
 *
 * Which stores exist is the site's answer — this asks the registry and installs
 * what was chosen, into the folder the shell installer would have used. The newly
 * installed store becomes the open one, so the window can carry straight on.
 */
export class StoreProvisioningService {
  public constructor (
    private readonly registry: StoreRegistryRepository,
    private readonly installer: StoreEngineInstaller,
    private readonly stores: InstalledStoreRepository,
    private readonly selection: StoreSelectionService
  ) {}

  public get registryUrl (): string {
    return this.registry.sourceUrl
  }

  public async listAvailableStores (): Promise<readonly RegistryStore[]> {
    return this.registry.listStores()
  }

  public async installStore (
    chosen: RegistryStore,
    progress?: EngineProgressListener
  ): Promise<InstalledStore> {
    const store = await this.resolveFromRegistry(chosen, progress)
    const home = this.stores.resolveDefaultHome(deriveStoreId(store))
    const installed = await this.installer.installEngine(home, store, progress)
    return this.selection.adoptStore(installed)
  }

  /**
   * The registry's own record for the store that was chosen.
   *
   * The window is handed stores to display and hands one back to install, but what it
   * hands back is not what gets used. A store's config decides where files are written
   * and which subtree the store may later delete from, so it cannot be something the
   * window supplies — the choice is treated as an identity, a name and a catalog, and
   * the record behind it is read again here.
   *
   * A store that has since left the registry, or a registry that cannot be reached, is
   * not a reason to refuse the install: it proceeds on the engine's defaults, which is
   * what a store with no config gets anyway.
   */
  private async resolveFromRegistry (
    chosen: RegistryStore,
    progress?: EngineProgressListener
  ): Promise<RegistryStore> {
    try {
      const listed = await this.registry.listStores()
      const found = listed.find((store: RegistryStore): boolean =>
        store.catalogUrl === chosen.catalogUrl && store.name === chosen.name)
      if (found !== undefined) return found
      progress?.onLog?.(
        `${chosen.name} is no longer in the registry — installing on the engine's defaults`)
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error)
      progress?.onLog?.(
        `the registry could not be read again (${reason}) — installing on the engine's defaults`)
    }
    return { ...chosen, config: null }
  }
}
