import type { BridgeApi } from '../shared/contracts/BridgeApi'
import type { ViewMode } from '../shared/contracts/dto/AppStateDto'
import { requireBridge } from './BridgeAccess'
import { AccountController } from './controllers/AccountController'
import { CatalogController } from './controllers/CatalogController'
import { ClientUpdateController } from './controllers/ClientUpdateController'
import { EngineStreamController } from './controllers/EngineStreamController'
import { PreferencesController } from './controllers/PreferencesController'
import { StoreController } from './controllers/StoreController'
import { AppStore, VISIBLE_STEP, type AppState } from './state/AppStore'
import { EVERYTHING, toggleOption, withQuery, type FilterAxis } from './state/CatalogFilter'
import type { SettingsTab } from './state/SettingsTab'
import { CatalogGridView } from './views/CatalogGridView'
import { CatalogListView } from './views/CatalogListView'
import { GameCardView } from './views/GameCardView'
import { GateView } from './views/GateView'
import { LogDrawerView } from './views/LogDrawerView'
import { SettingsView } from './views/SettingsView'
import { SideMenuView } from './views/SideMenuView'
import { SignInView } from './views/SignInView'
import { TopBarView } from './views/TopBarView'

/** A view: something with one `render(state)`, drawn in the order it was registered. */
interface View {
  readonly render: (state: AppState) => void
}

/**
 * The window, assembled.
 *
 * The flow is one direction only: a control calls a controller, the controller calls
 * the bridge and writes to the store, and the store re-renders every view. No view
 * reads another view, and nothing but the store decides what is on screen.
 */
export class RendererApplication {
  private readonly store = new AppStore()
  private readonly bridge: BridgeApi
  private readonly views: readonly View[]
  private readonly catalog: CatalogController
  private readonly stores: StoreController
  private readonly preferences: PreferencesController
  private readonly streams: EngineStreamController
  private readonly accounts: AccountController
  private readonly updates: ClientUpdateController

  public constructor (bridge: BridgeApi = requireBridge()) {
    this.bridge = bridge

    this.catalog = new CatalogController(this.bridge, this.store)
    this.stores = new StoreController(
      this.bridge, this.store, this.catalog,
      (question: string): boolean => window.confirm(question))
    this.preferences = new PreferencesController(this.bridge, this.store)
    this.streams = new EngineStreamController(this.bridge, this.store)
    this.updates = new ClientUpdateController(this.bridge, this.store)
    this.accounts = new AccountController(
      this.bridge, this.store,
      async (): Promise<void> => { await this.catalog.refresh() }
    )

    const cards = new GameCardView({
      onInstall: (name: string): void => { void this.catalog.syncGames([name]) },
      onUpgrade: (name: string): void => { void this.catalog.syncGames([name]) },
      onLaunch: (name: string): void => { void this.catalog.launchGame(name) },
      onRemove: (name: string): void => { void this.catalog.removeGame(name) },
      onReinstall: (name: string): void => { void this.catalog.reinstallGame(name) },
      onPurchase: (name: string): void => { void this.catalog.purchase(name) },
      onSignIn: (): void => { void this.accounts.signIn() }
    })

    this.views = [
      new SignInView({
        onOpenPage: (): void => { void this.accounts.openVerificationPage() },
        onCancel: (): void => { void this.accounts.cancelSignIn() }
      }),
      new TopBarView({
        onToggleNavigation: (): void => { void this.preferences.toggleNavigation() },
        onToggleViewMode: (): void => { void this.preferences.toggleViewMode() },
        onSearch: (query: string): void => {
          this.store.applyFilter(withQuery(this.store.readState().filter, query))
        }
      }),
      new SideMenuView({
        onSelectStore: (home: string): void => { void this.stores.selectStore(home) },
        onRefresh: (): void => { void this.catalog.refresh() },
        onToggleFilter: (axis: FilterAxis, value: string): void => {
          this.store.applyFilter(toggleOption(this.store.readState().filter, axis, value))
        },
        onClearFilters: (): void => { this.store.applyFilter(EVERYTHING) },
        onToggleSignedIn: (): void => { void this.accounts.toggleSignedIn() },
        onOpenSettings: (): void => { void this.stores.openSettings() }
      }),
      new SettingsView({
        onClose: (): void => { this.stores.closeSettings() },
        onSelectTab: (tab: SettingsTab): void => { this.store.applySettingsTab(tab) },
        onBeginRename: (home: string): void => { this.stores.beginRename(home) },
        onCancelRename: (): void => { this.stores.cancelRename() },
        onRename: (home: string, name: string): void => { void this.stores.renameStore(home, name) },
        onRemoveStore: (home: string, name: string): void => { void this.stores.removeStore(home, name) },
        onAddStore: (catalogUrl: string): void => { void this.stores.addStore(catalogUrl) },
        onAddCatalog: (catalogUrl: string): void => { void this.stores.addCatalog(catalogUrl) },
        onSelectLocale: (locale: string): void => { void this.preferences.selectLocale(locale) },
        onSelectViewMode: (mode: ViewMode): void => { void this.preferences.selectViewMode(mode) },
        onCheckForUpdates: (): void => { void this.updates.checkForUpdates() },
        onOpenRelease: (): void => { void this.updates.openRelease() },
        onUpgrade: (name: string): void => { void this.catalog.syncGames([name]) },
        onUpgradeAll: (names: readonly string[]): void => { void this.catalog.syncGames(names) }
      }),
      new LogDrawerView({
        onOpenFolder: (directory: string): void => { void this.bridge.openFolder(directory) },
        onToggle: (): void => { this.store.applyLogOpen(!this.store.readState().logOpen) }
      }),
      new GateView((url: string): void => { void this.bridge.openUrl(url) }),
      new CatalogGridView(cards, (): void => { this.showMore() }),
      new CatalogListView(cards, (): void => { this.showMore() })
    ]

    this.store.subscribe((state: AppState): void => { this.render(state) })
    this.streams.subscribe()
    this.accounts.subscribe()
  }

  /** Decides what the window is showing, then hands over to the views. */
  public async start (): Promise<void> {
    this.store.applyAppState(await this.bridge.readState())
    const state = this.store.readState()

    if (state.currentStore === null) {
      // A branded build installs its own store first and asks nobody; only if that
      // fails does the first run fall back to the registry's offer.
      if (state.brand !== null && await this.stores.installBrandStore(state.brand)) return
      await this.stores.offerStores()
      return
    }
    this.store.applyGate(null)
    await this.catalog.refresh()
  }

  private showMore (): void {
    const state = this.store.readState()
    this.store.applyVisibleCount(state.visibleCount + VISIBLE_STEP)
  }

  private render (state: AppState): void {
    document.body.classList.toggle('nav-closed', !state.navigationOpen)
    for (const view of this.views) view.render(state)
  }
}
