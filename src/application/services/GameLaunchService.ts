import type { GameLauncher } from '../../domain/ports/GameLauncher'
import type { CatalogService } from './CatalogService'

/**
 * Starting a title the window asked for by name.
 *
 * The name is all the window has; the launch target comes from the catalog this
 * process last read.
 */
export class GameLaunchService {
  public constructor (
    private readonly launcher: GameLauncher,
    private readonly catalog: CatalogService
  ) {}

  public async launchGame (name: string): Promise<boolean> {
    const game = this.catalog.findGame(name)
    if (game === null) return false
    return this.launcher.launchGame(game)
  }

  public async openFolder (directory: string): Promise<boolean> {
    return this.launcher.openFolder(directory)
  }

  public async openUrl (url: string): Promise<boolean> {
    return this.launcher.openUrl(url)
  }
}
