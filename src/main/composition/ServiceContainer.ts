import type { App, IpcMain, Shell } from 'electron'
import { AccountDtoMapper } from '../../application/mappers/AccountDtoMapper'
import { GameDtoMapper } from '../../application/mappers/GameDtoMapper'
import { InstalledStoreDtoMapper } from '../../application/mappers/InstalledStoreDtoMapper'
import { RegistryStoreDtoMapper } from '../../application/mappers/RegistryStoreDtoMapper'
import { StorePathsDtoMapper } from '../../application/mappers/StorePathsDtoMapper'
import { AccountService } from '../../application/services/AccountService'
import { ApplicationStateService } from '../../application/services/ApplicationStateService'
import { CatalogService } from '../../application/services/CatalogService'
import { GameLaunchService } from '../../application/services/GameLaunchService'
import { PreferencesService } from '../../application/services/PreferencesService'
import { StoreProvisioningService } from '../../application/services/StoreProvisioningService'
import { StoreSelectionService } from '../../application/services/StoreSelectionService'
import { BuildConfiguration } from '../../infrastructure/config/BuildConfiguration'
import { ElectronApplicationEnvironment } from '../../infrastructure/electron/ElectronApplicationEnvironment'
import { ElectronGameLauncher } from '../../infrastructure/electron/ElectronGameLauncher'
import { SafeStorageCredentialRepository } from '../../infrastructure/electron/SafeStorageCredentialRepository'
import { NativeStoreCatalogGateway } from '../../infrastructure/engine/NativeStoreCatalogGateway'
import { HttpTextClient } from '../../infrastructure/http/HttpTextClient'
import { FileSystemInstalledStoreRepository } from '../../infrastructure/repositories/FileSystemInstalledStoreRepository'
import { NativeStoreEngineInstaller } from '../../infrastructure/repositories/NativeStoreEngineInstaller'
import { HttpStoreRegistryRepository } from '../../infrastructure/repositories/HttpStoreRegistryRepository'
import { JsonFilePreferencesRepository } from '../../infrastructure/repositories/JsonFilePreferencesRepository'
import { AccountIpcController } from '../ipc/AccountIpcController'
import { AppIpcController } from '../ipc/AppIpcController'
import { CatalogIpcController } from '../ipc/CatalogIpcController'
import { IpcRouter } from '../ipc/IpcRouter'
import { SingleFlightGuard } from '../ipc/SingleFlightGuard'
import { StoreIpcController } from '../ipc/StoreIpcController'
import { TranslationCatalog } from '../../shared/i18n/TranslationCatalog'
import { WindowStreamBroadcaster } from '../streams/WindowStreamBroadcaster'

/**
 * The composition root: the only file that knows which implementation backs which
 * port.
 *
 * Every layer above depends on interfaces, so swapping the engine for a stub or the
 * registry for a local endpoint is a change here and nowhere else.
 */
export class ServiceContainer {
  public readonly streams: WindowStreamBroadcaster
  public readonly guard: SingleFlightGuard
  public readonly catalog: CatalogService
  public readonly selection: StoreSelectionService
  public readonly provisioning: StoreProvisioningService
  public readonly state: ApplicationStateService
  public readonly launching: GameLaunchService
  public readonly accounts: AccountService

  private readonly controllers: readonly { register: (router: IpcRouter) => void }[]

  public constructor (app: App, shell: Shell) {
    this.streams = new WindowStreamBroadcaster()
    this.guard = new SingleFlightGuard((busy: boolean): void => { this.streams.publishBusyChanged(busy) })

    const environment = new ElectronApplicationEnvironment(app)
    const httpClient = new HttpTextClient()
    const translations = new TranslationCatalog()
    const storeMapper = new InstalledStoreDtoMapper()
    const accountMapper = new AccountDtoMapper()

    const stores = new FileSystemInstalledStoreRepository()
    const credentials = new SafeStorageCredentialRepository(environment)
    const catalogGateway = new NativeStoreCatalogGateway(credentials, stores)
    const registry = new HttpStoreRegistryRepository(httpClient, new BuildConfiguration())
    const installer = new NativeStoreEngineInstaller()
    const preferencesRepository = new JsonFilePreferencesRepository(environment)

    const preferences = new PreferencesService(preferencesRepository, environment, translations)
    this.selection = new StoreSelectionService(stores, preferences)
    this.catalog = new CatalogService(catalogGateway, this.selection)
    this.accounts = new AccountService(catalogGateway, this.selection)
    this.provisioning = new StoreProvisioningService(
      registry, installer, stores, this.selection, catalogGateway
    )
    this.launching = new GameLaunchService(new ElectronGameLauncher(shell), this.catalog)
    this.state = new ApplicationStateService(
      preferences, this.selection, this.provisioning, environment, translations, storeMapper
    )

    this.controllers = [
      new AppIpcController(this.state, preferences, this.launching, translations),
      new CatalogIpcController(
        this.catalog, this.launching, this.guard, this.streams,
        new GameDtoMapper(), new StorePathsDtoMapper(), accountMapper),
      new StoreIpcController(
        this.provisioning, this.selection, this.state, this.guard, this.streams,
        new RegistryStoreDtoMapper(), storeMapper),
      new AccountIpcController(this.accounts, this.streams, accountMapper)
    ]
  }

  public registerIpc (ipc: IpcMain): void {
    const router = new IpcRouter(ipc)
    for (const controller of this.controllers) controller.register(router)
  }
}
