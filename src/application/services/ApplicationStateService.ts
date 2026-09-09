import type { InstalledStore } from '../../domain/models/InstalledStore'
import type { ApplicationEnvironment } from '../../domain/ports/ApplicationEnvironment'
import type { AppStateDto } from '../../shared/contracts/dto/AppStateDto'
import type { TranslationCatalog } from '../../shared/i18n/TranslationCatalog'
import type { InstalledStoreDtoMapper } from '../mappers/InstalledStoreDtoMapper'
import type { PreferencesService } from './PreferencesService'
import type { StoreProvisioningService } from './StoreProvisioningService'
import type { StoreSelectionService } from './StoreSelectionService'

/**
 * Everything the window needs before it can paint anything, in one answer.
 *
 * One call rather than six, because the first frame should not be a sequence of round
 * trips. There is one decision left in it — whether a store is set up yet — now that
 * the engine ships with the application and cannot be missing or out of date.
 */
export class ApplicationStateService {
  public constructor (
    private readonly preferences: PreferencesService,
    private readonly selection: StoreSelectionService,
    private readonly provisioning: StoreProvisioningService,
    private readonly environment: ApplicationEnvironment,
    private readonly translations: TranslationCatalog,
    private readonly storeMapper: InstalledStoreDtoMapper
  ) {}

  public readState (): AppStateDto {
    const locale = this.preferences.readLocale()
    const stores = this.selection.listStores()
    const current: InstalledStore | null = this.selection.readCurrentStore()

    return {
      locale,
      locales: this.translations.locales,
      messages: this.translations.readBundle(locale),
      navigationOpen: this.preferences.readNavigationOpen(),
      currentStore: current === null ? null : this.storeMapper.toDto(current),
      stores: this.storeMapper.toDtoList(stores),
      registryUrl: this.provisioning.registryUrl,
      defaultStoreRoot: this.selection.readDefaultStoreRoot(),
      appVersion: this.environment.readVersion(),
      viewMode: this.preferences.readViewMode()
    }
  }
}
