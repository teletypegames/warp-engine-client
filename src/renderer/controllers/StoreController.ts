import { describeError } from '../../domain/errors/DescribeError'
import type { BridgeApi } from '../../shared/contracts/BridgeApi'
import type { AppStateDto } from '../../shared/contracts/dto/AppStateDto'
import type { BrandDto } from '../../shared/contracts/dto/BrandDto'
import type { GameDto } from '../../shared/contracts/dto/GameDto'
import type { RegistryStoreDto } from '../../shared/contracts/dto/RegistryStoreDto'
import type { AppStore } from '../state/AppStore'
import type { CatalogController } from './CatalogController'

/** Asks the person a yes-or-no question and waits for the answer. */
export type ConfirmQuestion = (question: string) => boolean

/**
 * Which store the window drives, and how one gets onto the machine.
 *
 * The gate screens live here because they are all the same decision seen from
 * different angles: there is no store to show a catalog for, and this is what can be
 * done about it.
 *
 * The confirmation is injected: how a question is put to somebody is the window's
 * business, and a controller that called `window.confirm` itself could not be driven
 * from anywhere without a window.
 */
export class StoreController {
  public constructor (
    private readonly bridge: BridgeApi,
    private readonly store: AppStore,
    private readonly catalog: CatalogController,
    private readonly confirm: ConfirmQuestion
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
      this.store.applyLogLine(`${messages.switchFailed}: ${describeError(error)}`)
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
   *
   * The bridge answers with the application state after the removal, so one call is
   * both the deed and the new picture of the machine; which store is open afterwards
   * is the main process's decision, read from that answer.
   */
  public async removeStore (home: string, name: string): Promise<void> {
    const state = this.store.readState()
    const messages = state.messages
    const installed = state.currentStore?.home === home
      ? state.games.filter((game: GameDto): boolean => game.installed).length
      : null

    const question = installed === null
      ? messages.removeStoreConfirm.replace('%{store}', name)
      : messages.removeStoreConfirmGames
        .replace('%{store}', name)
        .replace('%{count}', String(installed))
    if (!this.confirm(question)) return

    try {
      const remaining = await this.bridge.removeStore(home)
      this.applyStateAndReopen(remaining)
      if (remaining.currentStore === null) {
        // Nothing left to manage: the dialog goes and the gate takes over.
        this.store.applySettingsOpen(false)
        await this.offerStores()
        return
      }
      if (this.store.readState().currentStore?.home !== state.currentStore?.home) await this.catalog.refresh()
    } catch (error: unknown) {
      this.store.applyLogLine(describeError(error))
    }
  }

  /**
   * The settings dialog, and the registry's list for its picker.
   *
   * The list is asked for on every opening rather than kept: a store added on the site
   * since the last look should be there, and a dialog is opened rarely enough that the
   * request costs nothing anyone notices. The answer lands in the state whenever it
   * comes; a dialog closed in the meantime has already forgotten it.
   */
  public async openSettings (): Promise<void> {
    this.store.applySettingsOpen(true)
    const result = await this.bridge.listRegistryStores()
    if (this.store.readState().settingsOpen) this.store.applyRegistry(result)
  }

  public closeSettings (): void {
    this.store.applySettingsOpen(false)
  }

  public beginRename (home: string): void {
    this.store.applyRenaming(home)
  }

  public cancelRename (): void {
    this.store.applyRenaming(null)
  }

  /** The new name, and the state afterwards, which is where the renamed record comes from. */
  public async renameStore (home: string, name: string): Promise<void> {
    const messages = this.store.readState().messages
    try {
      this.store.applyAppState(await this.bridge.renameStore(home, name))
      this.store.applyRenaming(null)
    } catch (error: unknown) {
      this.store.applyLogLine(`${messages.renameFailed}: ${describeError(error)}`)
    }
  }

  /** A store from the registry's list, found in the state by the catalog the picker named. */
  public async addStore (catalogUrl: string): Promise<void> {
    const chosen = this.store.readState().registry?.stores
      .find((store: RegistryStoreDto): boolean => store.catalogUrl === catalogUrl)
    if (chosen !== undefined) await this.installStore(chosen)
  }

  public async addCatalog (catalogUrl: string): Promise<void> {
    await this.installCatalog(catalogUrl)
  }

  private async installCatalog (catalogUrl: string): Promise<void> {
    await this.provision(async (): Promise<AppStateDto> => this.bridge.installCatalog(catalogUrl))
  }

  /**
   * A branded build's first run: its store, installed without asking, under the
   * brand's name. True when it worked; false hands the first run back to the
   * registry offer, so a brand whose catalog is down still leaves a usable client.
   */
  public async installBrandStore (brand: BrandDto): Promise<boolean> {
    return this.provision(async (): Promise<AppStateDto> => this.bridge.installCatalog(brand.catalogUrl, brand.name))
  }

  private async installStore (chosen: RegistryStoreDto): Promise<void> {
    await this.provision(async (): Promise<AppStateDto> => this.bridge.installStore(chosen))
  }

  /**
   * Both ways of getting a store end the same: the state the main process reports
   * afterwards replaces the window's, the gate and the settings come down, and the new
   * store's catalog is read and synced. A failure goes to the log and leaves the screen
   * where it was.
   */
  private async provision (install: () => Promise<AppStateDto>): Promise<boolean> {
    const messages = this.store.readState().messages
    this.store.applyProgress({ total: 0, done: 0, label: messages.setupWorking })
    try {
      this.applyStateAndReopen(await install())
      this.store.applySettingsOpen(false)
      await this.catalog.refresh()
      await this.catalog.syncGames([])
      return true
    } catch (error: unknown) {
      this.store.applyLogLine(describeError(error))
      return false
    } finally {
      this.store.applyProgress(null)
    }
  }

  private applyStateAndReopen (state: AppStateDto): void {
    this.store.applyAppState(state)
    this.store.applyGate(null)
  }
}
