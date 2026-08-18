import type { BridgeApi } from '../../shared/contracts/BridgeApi'
import type { AppStore } from '../state/AppStore'

/** The two things the window remembers: its language and whether the menu is open. */
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
}
