import type { CatalogListing } from '../../domain/models/CatalogListing'
import type { EngineProgressListener } from '../../domain/models/EngineProgress'
import type { Game } from '../../domain/models/Game'
import type { StorePaths } from '../../domain/models/StorePaths'
import type { StoreCatalogGateway } from '../../domain/ports/StoreCatalogGateway'
import type { StoreSelectionService } from './StoreSelectionService'

/**
 * The catalog of the store that is open.
 *
 * The last listing is kept so a launch can be resolved by name: the window asks
 * for "pong", and the paths it would need to start it never leave this process.
 */
export class CatalogService {
  private lastListing: CatalogListing | null = null

  public constructor (
    private readonly catalogGateway: StoreCatalogGateway,
    private readonly selection: StoreSelectionService
  ) {}

  public async listGames (progress?: EngineProgressListener): Promise<CatalogListing> {
    const listing = await this.catalogGateway.listGames(this.selection.requireCurrentStore(), progress)
    this.lastListing = listing
    return listing
  }

  public async readPaths (progress?: EngineProgressListener): Promise<StorePaths> {
    return this.catalogGateway.readPaths(this.selection.requireCurrentStore(), progress)
  }

  public async syncGames (names: readonly string[], progress?: EngineProgressListener): Promise<void> {
    await this.catalogGateway.syncGames(this.selection.requireCurrentStore(), names, progress)
    this.forgetListing()
  }

  public async removeGame (name: string, progress?: EngineProgressListener): Promise<void> {
    await this.catalogGateway.removeGame(this.selection.requireCurrentStore(), name, progress)
    this.forgetListing()
  }

  public findGame (name: string): Game | null {
    return this.lastListing?.games.find((game: Game): boolean => game.name === name) ?? null
  }


  /** After a write the listing is stale; the window refreshes anyway. */
  public forgetListing (): void {
    this.lastListing = null
  }
}
