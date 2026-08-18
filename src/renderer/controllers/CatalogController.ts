import type { BridgeApi } from '../../shared/contracts/BridgeApi'
import type { CatalogListingDto } from '../../shared/contracts/dto/CatalogListingDto'
import type { AppStore } from '../state/AppStore'
import type { LogDrawerView } from '../views/LogDrawerView'

/**
 * The catalog operations, as the window performs them.
 *
 * Every one of them ends in a refresh: the engine is the authority on what is
 * installed, so the window asks again rather than guessing what changed.
 */
export class CatalogController {
  public constructor (
    private readonly bridge: BridgeApi,
    private readonly store: AppStore,
    private readonly log: LogDrawerView
  ) {}

  public async refresh (): Promise<void> {
    try {
      const listing: CatalogListingDto = await this.bridge.listGames()
      this.store.applyCatalog(listing.games, listing.paths)
      for (const reason of listing.skipped) this.log.appendLine(`skipped ${reason}`)
    } catch (error: unknown) {
      this.reportFailure(error)
    }
  }

  public async syncGames (names: readonly string[]): Promise<void> {
    try {
      await this.bridge.syncGames(names)
    } catch (error: unknown) {
      this.reportFailure(error)
    }
    await this.refresh()
  }

  public async removeGame (name: string): Promise<void> {
    try {
      await this.bridge.removeGame(name)
    } catch (error: unknown) {
      this.reportFailure(error)
    }
    await this.refresh()
  }

  public async launchGame (name: string): Promise<void> {
    try {
      const launched = await this.bridge.launchGame(name)
      if (!launched) this.log.appendLine(`${name}: ${this.store.readState().messages.failed}`)
    } catch (error: unknown) {
      this.reportFailure(error)
    }
  }

  private reportFailure (error: unknown): void {
    this.log.appendLine(error instanceof Error ? error.message : String(error))
  }
}
