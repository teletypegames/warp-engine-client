import { MINIMUM_ENGINE_VERSION, formatVersion } from '../../domain/models/EngineVersion'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import type { ApplicationEnvironment } from '../../domain/ports/ApplicationEnvironment'
import type { PythonRuntimeLocator } from '../../domain/ports/PythonRuntimeLocator'
import type { AppStateDto } from '../../shared/contracts/dto/AppStateDto'
import { TranslationCatalog } from '../../shared/i18n/TranslationCatalog'
import { EngineVersionDtoMapper } from '../mappers/EngineVersionDtoMapper'
import { InstalledStoreDtoMapper } from '../mappers/InstalledStoreDtoMapper'
import type { PreferencesService } from './PreferencesService'
import type { StoreProvisioningService } from './StoreProvisioningService'
import type { StoreSelectionService } from './StoreSelectionService'

/**
 * Everything the window needs before it can paint anything, in one answer.
 *
 * One call rather than six, because the first frame should not be a sequence of
 * round trips — and because the decisions the window makes from it (no Python, no
 * store, an engine too old) all depend on each other.
 */
export class ApplicationStateService {
  public constructor (
    private readonly preferences: PreferencesService,
    private readonly selection: StoreSelectionService,
    private readonly provisioning: StoreProvisioningService,
    private readonly pythonLocator: PythonRuntimeLocator,
    private readonly environment: ApplicationEnvironment,
    private readonly translations: TranslationCatalog = new TranslationCatalog(),
    private readonly storeMapper: InstalledStoreDtoMapper = new InstalledStoreDtoMapper(),
    private readonly engineMapper: EngineVersionDtoMapper = new EngineVersionDtoMapper()
  ) {}

  public readState (): AppStateDto {
    const locale = this.preferences.readLocale()
    const stores = this.selection.listStores()
    const current: InstalledStore | null = this.selection.findCurrentStore()
    const engine = current === null ? null : this.selection.findEngineVersion(current)
    const runtime = this.pythonLocator.findRuntime()

    return {
      locale,
      locales: this.translations.locales,
      messages: this.translations.readBundle(locale),
      navigationOpen: this.preferences.readNavigationOpen(),
      pythonVersion: runtime === null ? null : runtime.version,
      currentStore: current === null ? null : this.storeMapper.toDto(current),
      stores: this.storeMapper.toDtoList(stores),
      engine: engine === null ? null : this.engineMapper.toDto(engine),
      minimumEngineVersion: formatVersion(MINIMUM_ENGINE_VERSION),
      registryUrl: this.provisioning.registryUrl,
      defaultStoreRoot: this.selection.readDefaultStoreRoot(),
      appVersion: this.environment.readVersion()
    }
  }
}
