import { describeError } from '../../domain/errors/DescribeError'
import type { BridgeApi } from '../../shared/contracts/BridgeApi'
import type { CatalogListingDto } from '../../shared/contracts/dto/CatalogListingDto'
import type { GameDto } from '../../shared/contracts/dto/GameDto'
import type { AppStore } from '../state/AppStore'

/**
 * The catalog operations, as the window performs them.
 *
 * Every one of them ends in a refresh: the engine is the authority on what is
 * installed, so the window asks again rather than guessing what changed.
 */
export class CatalogController {
  public constructor (
    private readonly bridge: BridgeApi,
    private readonly store: AppStore
  ) {}

  public async refresh (): Promise<void> {
    try {
      const listing: CatalogListingDto = await this.bridge.listGames()
      this.store.applyCatalog(listing.games, listing.paths, listing.account)
      for (const reason of listing.skipped) this.store.applyLogLine(`skipped ${reason}`)
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

  public async reinstallGame (name: string): Promise<void> {
    try {
      await this.bridge.reinstallGame(name)
    } catch (error: unknown) {
      this.reportFailure(error)
    }
    await this.refresh()
  }

  public async launchGame (name: string): Promise<void> {
    try {
      const launched = await this.bridge.launchGame(name)
      if (!launched) this.store.applyLogLine(`${name}: ${this.store.readState().messages.failed}`)
    } catch (error: unknown) {
      this.reportFailure(error)
    }
  }

  /**
   * Buying happens in a browser.
   *
   * A checkout rebuilt in this window would be a second place to get card handling
   * wrong, and the store's own pages already do it. What this side owes afterwards is
   * a refresh, which the Refresh button is for.
   */
  public async purchase (name: string): Promise<void> {
    const url = this.store.readState().games
      .find((candidate: GameDto): boolean => candidate.name === name)?.purchaseUrl ?? null
    if (url === null) return

    await this.bridge.openUrl(url)
  }

  private reportFailure (error: unknown): void {
    this.store.applyLogLine(describeError(error))
  }
}
