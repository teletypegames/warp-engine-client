import type { BridgeApi } from '../../shared/contracts/BridgeApi'
import type { ViewMode } from '../../shared/contracts/dto/AppStateDto'
import type { AppStore } from '../state/AppStore'

/** What the window remembers: its language, whether the menu is open, and which view mode. */
export class PreferencesController {
  public constructor (
    private readonly bridge: BridgeApi,
    private readonly store: AppStore
  ) {}

  public async selectLocale (candidate: string): Promise<void> {
    const selection = await this.bridge.updateLocale(candidate)
    this.store.applyMessages(selection.locale, selection.messages)
  }

  public async toggleNavigation (): Promise<void> {
    const open = !this.store.readState().navigationOpen
    this.store.applyNavigationOpen(open)
    await this.bridge.updateNavOpen(open)
  }

  public async toggleViewMode (): Promise<void> {
    await this.selectViewMode(this.store.readState().viewMode === 'grid' ? 'list' : 'grid')
  }

  /** The bar's toggle and the settings' choice write the same preference, so they always agree. */
  public async selectViewMode (mode: ViewMode): Promise<void> {
    this.store.applyViewMode(mode)
    await this.bridge.updateViewMode(mode)
  }
}
