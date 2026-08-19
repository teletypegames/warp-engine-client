import { InstalledStoreDtoMapper } from '../../application/mappers/InstalledStoreDtoMapper'
import { RegistryStoreDtoMapper } from '../../application/mappers/RegistryStoreDtoMapper'
import type { StoreProvisioningService } from '../../application/services/StoreProvisioningService'
import type { StoreSelectionService } from '../../application/services/StoreSelectionService'
import { IPC_CHANNELS } from '../../shared/contracts/IpcChannels'
import type { InstalledStoreDto } from '../../shared/contracts/dto/InstalledStoreDto'
import type { RegistryResultDto } from '../../shared/contracts/dto/RegistryResultDto'
import type { StoreSelectionDto } from '../../shared/contracts/dto/StoreSelectionDto'
import type { WindowStreamBroadcaster } from '../streams/WindowStreamBroadcaster'
import { requireRegistryStore, requireString } from './IpcArguments'
import type { IpcRouter } from './IpcRouter'
import type { SingleFlightGuard } from './SingleFlightGuard'

/** Which stores exist, which one is open, and installing a new one. */
export class StoreIpcController {
  public constructor (
    private readonly provisioning: StoreProvisioningService,
    private readonly selection: StoreSelectionService,
    private readonly guard: SingleFlightGuard,
    private readonly streams: WindowStreamBroadcaster,
    private readonly registryMapper: RegistryStoreDtoMapper = new RegistryStoreDtoMapper(),
    private readonly storeMapper: InstalledStoreDtoMapper = new InstalledStoreDtoMapper()
  ) {}

  public register (router: IpcRouter): void {
    router.handle(IPC_CHANNELS.storeListRegistry, async (): Promise<RegistryResultDto> =>
      this.handleListRegistry())
    router.handle(IPC_CHANNELS.storeInstallStore, async (store: unknown): Promise<InstalledStoreDto> =>
      this.handleInstallStore(store))
    router.handle(IPC_CHANNELS.storeInstallCatalog, async (url: unknown): Promise<InstalledStoreDto> =>
      this.handleInstallCatalog(requireString(url, 'catalogUrl')))
    router.handle(IPC_CHANNELS.storeSelectStore, (home: unknown): StoreSelectionDto =>
      this.handleSelectStore(requireString(home, 'home')))
    router.handle(IPC_CHANNELS.storeRemoveStore, async (home: unknown): Promise<void> =>
      this.handleRemoveStore(requireString(home, 'home')))
  }

  /**
   * The registry lookup never rejects: the window has to say *why* there is nothing
   * to install, and an unreachable site and an empty list need different words.
   */
  private async handleListRegistry (): Promise<RegistryResultDto> {
    try {
      const stores = await this.provisioning.listAvailableStores()
      return {
        stores: this.registryMapper.toDtoList(stores),
        sourceUrl: this.provisioning.registryUrl,
        error: null
      }
    } catch (error: unknown) {
      return {
        stores: [],
        sourceUrl: this.provisioning.registryUrl,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async handleInstallStore (payload: unknown): Promise<InstalledStoreDto> {
    const chosen = this.registryMapper.toModel(requireRegistryStore(payload))
    return this.guard.run(async (): Promise<InstalledStoreDto> => {
      const installed = await this.provisioning.installStore(chosen, this.streams.asProgressListener())
      return this.storeMapper.toDto(installed)
    })
  }

  /**
   * A catalog somebody typed, rather than one the registry offered.
   *
   * Only the address crosses the bridge. The name is derived from it and the
   * configuration comes from the engine's defaults, so a typed URL can no more decide
   * where files land than a registry record can.
   */
  private async handleInstallCatalog (catalogUrl: string): Promise<InstalledStoreDto> {
    return this.guard.run(async (): Promise<InstalledStoreDto> => {
      const installed = await this.provisioning.installCatalog(
        catalogUrl, null, this.streams.asProgressListener()
      )
      return this.storeMapper.toDto(installed)
    })
  }

  private handleSelectStore (home: string): StoreSelectionDto {
    return { store: this.storeMapper.toDto(this.selection.selectStore(home)) }
  }

  /**
   * Remove a store by its home.
   *
   * The home is resolved against the stores actually on this machine before anything
   * is deleted — the window names a store, never a path. Guarded, because it uninstalls
   * every title the store put here and a second engine call across that would be
   * working on files this one is removing.
   */
  private async handleRemoveStore (home: string): Promise<void> {
    await this.guard.run(async (): Promise<void> => {
      await this.provisioning.removeStore(
        this.selection.requireStoreAt(home), this.streams.asProgressListener()
      )
    })
  }
}
