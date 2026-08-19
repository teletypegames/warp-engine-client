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
      this.store.applySelectedStore(selection.store)
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

    // A typed address works whatever the registry said — that is the point of it — so
    // it is attached to every one of the three outcomes below, including the two that
    // used to be dead ends.
    const custom = {
      label: messages.customTitle,
      hint: messages.customHint,
      actionLabel: messages.customAction,
      perform: (catalogUrl: string): void => { void this.installCatalog(catalogUrl) }
    }
    // Only where there is something to go back to. On a machine with no store the grid
    // behind this screen is empty, and "Cancel" would lead nowhere. Spread rather than
    // an `undefined` value: the strict optional-property rule treats "absent" and
    // "present but undefined" as different things, and here they genuinely are.
    const cancel = state.currentStore === null
      ? {}
      : { cancel: { label: messages.cancel, perform: (): void => { this.store.applyGate(null) } } }

    if (result.error !== null) {
      this.store.applyGate({
        title: messages.registryFailed,
        body: `${result.sourceUrl}\n\n${result.error}`,
        action: { label: messages.registryRetry, perform: (): void => { void this.offerStores() } },
        custom,
        ...cancel
      })
      return
    }

    if (result.stores.length === 0) {
      this.store.applyGate({
        title: messages.setupTitle,
        body: `${messages.registryEmpty}\n\n${result.sourceUrl}`,
        custom,
        ...cancel
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
      choices: result.stores,
      custom,
      ...cancel
    })
  }

  /**
   * Take a store off this machine, with what that costs stated first.
   *
   * The confirmation names the number of installed titles, because that is the part
   * somebody would not otherwise expect: removing a store uninstalls everything it
   * put here. Leaving them behind would be worse — the store's state file is the only
   * record of which files belong to it, so orphans would be permanent.
   */
  public async removeStore (home: string, name: string): Promise<void> {
    const state = this.store.readState()
    const messages = state.messages
    const installed = state.currentStore?.home === home
      ? state.games.filter((game): boolean => game.installed).length
      : null

    const question = installed === null
      ? messages.removeStoreConfirm.replace('%{store}', name)
      : messages.removeStoreConfirmGames
        .replace('%{store}', name)
        .replace('%{count}', String(installed))
    if (!window.confirm(question)) return

    try {
      await this.bridge.removeStore(home)
      this.store.applyAppState(await this.bridge.readState())
      const remaining = this.store.readState().currentStore
      this.store.applyGate(null)
      if (remaining === null) {
        await this.offerStores()
        return
      }
      await this.catalog.refresh()
    } catch (error: unknown) {
      this.log.appendLine(error instanceof Error ? error.message : String(error))
    }
  }

  private async installCatalog (catalogUrl: string): Promise<void> {
    const messages = this.store.readState().messages
    this.store.applyProgress({ total: 0, done: 0, label: messages.setupWorking })
    try {
      await this.bridge.installCatalog(catalogUrl)
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
