import type { ApplicationStateService } from '../../application/services/ApplicationStateService'
import type { GameLaunchService } from '../../application/services/GameLaunchService'
import type { PreferencesService } from '../../application/services/PreferencesService'
import { IPC_CHANNELS } from '../../shared/contracts/IpcChannels'
import type { AppStateDto } from '../../shared/contracts/dto/AppStateDto'
import type { LocaleSelectionDto } from '../../shared/contracts/dto/LocaleSelectionDto'
import type { TranslationCatalog } from '../../shared/i18n/TranslationCatalog'
import type { ViewMode } from '../../shared/contracts/dto/AppStateDto'
import { requireBoolean, requireString, requireViewMode } from './IpcArguments'
import type { IpcRouter } from './IpcRouter'

/** The window's own concerns: what it needs to paint, its language, its menu state. */
export class AppIpcController {
  public constructor (
    private readonly state: ApplicationStateService,
    private readonly preferences: PreferencesService,
    private readonly launching: GameLaunchService,
    private readonly translations: TranslationCatalog
  ) {}

  public register (router: IpcRouter): void {
    router.handle(IPC_CHANNELS.appReadState, (): AppStateDto => this.handleReadState())
    router.handle(IPC_CHANNELS.appUpdateLocale, (locale: unknown): LocaleSelectionDto =>
      this.handleUpdateLocale(requireString(locale, 'locale')))
    router.handle(IPC_CHANNELS.appUpdateNavOpen, (open: unknown): boolean =>
      this.handleUpdateNavOpen(requireBoolean(open, 'open')))
    router.handle(IPC_CHANNELS.appUpdateViewMode, (mode: unknown): ViewMode =>
      this.handleUpdateViewMode(requireViewMode(mode, 'mode')))
    router.handle(IPC_CHANNELS.appOpenFolder, async (directory: unknown): Promise<boolean> =>
      this.handleOpenFolder(requireString(directory, 'directory')))
    router.handle(IPC_CHANNELS.appOpenUrl, async (url: unknown): Promise<boolean> =>
      this.handleOpenUrl(requireString(url, 'url')))
  }

  private handleReadState (): AppStateDto {
    return this.state.readState()
  }

  private handleUpdateLocale (candidate: string): LocaleSelectionDto {
    const locale = this.preferences.updateLocale(candidate)
    return { locale, messages: this.translations.readBundle(locale) }
  }

  private handleUpdateNavOpen (open: boolean): boolean {
    return this.preferences.updateNavigationOpen(open)
  }

  private handleUpdateViewMode (mode: ViewMode): ViewMode {
    return this.preferences.updateViewMode(mode)
  }

  private async handleOpenFolder (directory: string): Promise<boolean> {
    return this.launching.openFolder(directory)
  }

  private async handleOpenUrl (url: string): Promise<boolean> {
    return this.launching.openUrl(url)
  }
}
