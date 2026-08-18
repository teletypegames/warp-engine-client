import type { BridgeApi } from '../shared/contracts/BridgeApi'
import { requireBridge } from './BridgeAccess'
import { CatalogController } from './controllers/CatalogController'
import { EngineStreamController } from './controllers/EngineStreamController'
import { PreferencesController } from './controllers/PreferencesController'
import { StoreController } from './controllers/StoreController'
import { AppStore, type AppState } from './state/AppStore'
import { buildCategorySections, resolveFilter, type CategoryFilter } from './state/CategoryFilter'
import { CatalogGridView } from './views/CatalogGridView'
import { GameCardView } from './views/GameCardView'
import { GateView } from './views/GateView'
import { LogDrawerView } from './views/LogDrawerView'
import { SideMenuView } from './views/SideMenuView'
import { TopBarView } from './views/TopBarView'

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
  private readonly log: LogDrawerView
  private readonly gate: GateView
  private readonly grid: CatalogGridView
  private readonly topBar: TopBarView
  private readonly sideMenu: SideMenuView
  private readonly catalog: CatalogController
  private readonly stores: StoreController
  private readonly preferences: PreferencesController
  private readonly streams: EngineStreamController

  public constructor (bridge: BridgeApi = requireBridge()) {
    this.bridge = bridge

    this.log = new LogDrawerView({
      onOpenFolder: (directory: string): void => { void this.bridge.openFolder(directory) }
    })
    this.gate = new GateView((url: string): void => { void this.bridge.openUrl(url) })
    this.catalog = new CatalogController(this.bridge, this.store, this.log)
    this.stores = new StoreController(this.bridge, this.store, this.gate, this.log, this.catalog)
    this.preferences = new PreferencesController(this.bridge, this.store)
    this.streams = new EngineStreamController(this.bridge, this.store, this.log)

    this.grid = new CatalogGridView(new GameCardView({
      onInstall: (name: string): void => { void this.catalog.syncGames([name]) },
      onLaunch: (name: string): void => { void this.catalog.launchGame(name) },
      onRemove: (name: string): void => { void this.catalog.removeGame(name) }
    }))
    this.topBar = new TopBarView({
      onToggleNavigation: (): void => { void this.preferences.toggleNavigation() }
    })
    this.sideMenu = new SideMenuView({
      onSelectStore: (home: string): void => { void this.stores.selectStore(home) },
      onAddStore: (): void => { void this.stores.offerStores() },
      onSyncAll: (): void => { void this.catalog.syncGames([]) },
      onRefresh: (): void => { void this.catalog.refresh() },
      onSelectCategory: (filter: CategoryFilter): void => { this.store.applyFilter(filter) },
      onSelectLocale: (locale: string): void => { void this.preferences.selectLocale(locale) }
    })

    this.store.subscribe((state: AppState): void => { this.render(state) })
    this.streams.subscribe()
  }

  /** Decides what the window is showing, then hands over to the views. */
  public async start (): Promise<void> {
    this.store.applyAppState(await this.bridge.readState())
    const state = this.store.readState()

    if (state.pythonVersion === null) {
      this.stores.showMissingPythonGate()
      return
    }
    if (state.currentStore === null) {
      await this.stores.offerStores()
      return
    }
    if (state.engine !== null && !state.engine.supported) {
      this.stores.showOutdatedEngineGate()
      return
    }
    this.gate.hide()
    await this.catalog.refresh()
  }

  private render (state: AppState): void {
    // The filter is corrected before anything is drawn from it, so the menu and the
    // grid can never disagree about which category is active.
    const corrected = resolveFilter(state.filter, buildCategorySections(state.games, state.messages))
    if (corrected !== state.filter) {
      this.store.applyFilter(corrected)
      return
    }

    document.body.classList.toggle('nav-closed', !state.navigationOpen)
    this.topBar.render(state)
    this.sideMenu.render(state)
    this.log.render(state)
    if (this.gate.visible) this.grid.hide()
    else this.grid.render(state)
  }
}
