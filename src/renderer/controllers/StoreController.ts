import type { BridgeApi } from '../../shared/contracts/BridgeApi'
import type { RegistryStoreDto } from '../../shared/contracts/dto/RegistryStoreDto'
import type { AppStore } from '../state/AppStore'
import type { LogDrawerView } from '../views/LogDrawerView'
import type { CatalogController } from './CatalogController'

/**
 * Which store the window drives, and how one gets onto the machine.
 *
 * The gate screens live here because they are all the same decision seen from
 * different angles: there is no store to show a catalog for, and this is what can be
 * done about it.
 */
export class StoreController {
  public constructor (
    private readonly bridge: BridgeApi,
    private readonly store: AppStore,
    private readonly log: LogDrawerView,
    private readonly catalog: CatalogController
  ) {}

  /** Open another store that is already on this machine. */
  public async selectStore (home: string): Promise<void> {
    const messages = this.store.readState().messages
    try {
      const selection = await this.bridge.selectStore(home)
      this.store.applySelectedStore(selection.store, selection.engine)
      if (selection.engine !== null && !selection.engine.supported) {
        this.showOutdatedEngineGate()
        return
      }
      this.store.applyGate(null)
      await this.catalog.refresh()
    } catch (error: unknown) {
      this.log.appendLine(`${messages.switchFailed}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Which stores exist is the site's answer, not this client's: the registry is asked
   * for it, and its records carry the catalog and the config repository.
   */
  public async offerStores (): Promise<void> {
    const state = this.store.readState()
    const messages = state.messages
    const result = await this.bridge.listRegistryStores()

    if (result.error !== null) {
      this.store.applyGate({
        title: messages.registryFailed,
        body: `${result.sourceUrl}\n\n${result.error}`,
        action: { label: messages.registryRetry, perform: (): void => { void this.offerStores() } }
      })
      return
    }

    if (result.stores.length === 0) {
      this.store.applyGate({
        title: messages.setupTitle,
        body: `${messages.registryEmpty}\n\n${result.sourceUrl}`
      })
      return
    }

    this.store.applyGate({
      title: messages.setupTitle,
      body: `${messages.setupBody}\n\n${state.defaultStoreRoot}`,
      action: {
        label: messages.setupAction,
        perform: (chosen: RegistryStoreDto | null): void => {
          if (chosen !== null) void this.installStore(chosen)
        }
      },
      choices: result.stores
    })
  }

  public showOutdatedEngineGate (): void {
    const state = this.store.readState()
    const engineText = state.engine === null ? '' : state.engine.text
    this.store.applyGate({
      title: state.messages.oldEngineTitle,
      body: `${state.messages.oldEngineBody}\n\n${engineText} → ${state.minimumEngineVersion}`,
      action: { label: state.messages.oldEngineAction, perform: (): void => { void this.offerStores() } }
    })
  }

  public showMissingPythonGate (): void {
    const messages = this.store.readState().messages
    this.store.applyGate({
      title: messages.noPythonTitle,
      body: messages.noPythonBody,
      link: { label: messages.pythonLink, url: 'https://www.python.org/downloads/' }
    })
  }

  private async installStore (chosen: RegistryStoreDto): Promise<void> {
    const messages = this.store.readState().messages
    this.store.applyProgress({ total: 0, done: 0, label: messages.setupWorking })
    try {
      await this.bridge.installStore(chosen)
      this.store.applyAppState(await this.bridge.readState())
      this.store.applyGate(null)
      await this.catalog.refresh()
      await this.catalog.syncGames([])
    } catch (error: unknown) {
      this.log.appendLine(error instanceof Error ? error.message : String(error))
    } finally {
      this.store.applyProgress(null)
    }
  }
}
