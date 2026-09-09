import type { InstalledStoreDtoMapper } from '../../application/mappers/InstalledStoreDtoMapper'
import type { RegistryStoreDtoMapper } from '../../application/mappers/RegistryStoreDtoMapper'
import type { ApplicationStateService } from '../../application/services/ApplicationStateService'
import type { StoreProvisioningService } from '../../application/services/StoreProvisioningService'
import type { StoreSelectionService } from '../../application/services/StoreSelectionService'
import { describeError } from '../../domain/errors/DescribeError'
import { IPC_CHANNELS } from '../../shared/contracts/IpcChannels'
import type { AppStateDto } from '../../shared/contracts/dto/AppStateDto'
import type { RegistryResultDto } from '../../shared/contracts/dto/RegistryResultDto'
import type { StoreSelectionDto } from '../../shared/contracts/dto/StoreSelectionDto'
import type { WindowStreamBroadcaster } from '../streams/WindowStreamBroadcaster'
import { requireRegistryStore, requireString } from './IpcArguments'
import type { IpcRouter } from './IpcRouter'
import type { SingleFlightGuard } from './SingleFlightGuard'

/**
 * Which stores exist, which one is open, and installing or removing one.
 *
 * Installing and removing answer with the whole application state rather than the
 * store touched: which store is open afterwards is this side's decision, and one
 * answer saves the window a second round trip to find out.
 */
export class StoreIpcController {
  public constructor (
    private readonly provisioning: StoreProvisioningService,
    private readonly selection: StoreSelectionService,
    private readonly state: ApplicationStateService,
    private readonly guard: SingleFlightGuard,
    private readonly streams: WindowStreamBroadcaster,
    private readonly registryMapper: RegistryStoreDtoMapper,
    private readonly storeMapper: InstalledStoreDtoMapper
  ) {}

  public register (router: IpcRouter): void {
    router.handle(IPC_CHANNELS.storeListRegistry, async (): Promise<RegistryResultDto> =>
      this.handleListRegistry())
    router.handle(IPC_CHANNELS.storeInstallStore, async (store: unknown): Promise<AppStateDto> =>
      this.handleInstallStore(store))
    router.handle(IPC_CHANNELS.storeInstallCatalog, async (url: unknown): Promise<AppStateDto> =>
      this.handleInstallCatalog(requireString(url, 'catalogUrl')))
    router.handle(IPC_CHANNELS.storeSelectStore, (home: unknown): StoreSelectionDto =>
      this.handleSelectStore(requireString(home, 'home')))
    router.handle(IPC_CHANNELS.storeRemoveStore, async (home: unknown): Promise<AppStateDto> =>
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
        error: describeError(error)
      }
    }
  }

  private async handleInstallStore (payload: unknown): Promise<AppStateDto> {
    const chosen = this.registryMapper.toModel(requireRegistryStore(payload))
    return this.guard.run(async (): Promise<AppStateDto> => {
      await this.provisioning.installStore(chosen, this.streams.asProgressListener())
      return this.state.readState()
    })
  }

  /**
   * A catalog somebody typed, rather than one the registry offered.
   *
   * Only the address crosses the bridge. The name is derived from it and the
   * configuration comes from the engine's defaults, so a typed URL can no more decide
   * where files land than a registry record can.
   */
  private async handleInstallCatalog (catalogUrl: string): Promise<AppStateDto> {
    return this.guard.run(async (): Promise<AppStateDto> => {
      await this.provisioning.installCatalog(catalogUrl, null, this.streams.asProgressListener())
      return this.state.readState()
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
  private async handleRemoveStore (home: string): Promise<AppStateDto> {
    return this.guard.run(async (): Promise<AppStateDto> => {
      await this.provisioning.removeStore(
        this.selection.requireStoreAt(home), this.streams.asProgressListener()
      )
      return this.state.readState()
    })
  }
}
