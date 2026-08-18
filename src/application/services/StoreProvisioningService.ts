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
    store: RegistryStore,
    progress?: EngineProgressListener
  ): Promise<InstalledStore> {
    const home = this.stores.resolveDefaultHome(deriveStoreId(store))
    const installed = await this.installer.installEngine(home, store, progress)
    return this.selection.adoptStore(installed)
  }
}
