import type { Game } from '../../domain/models/Game'
import type { GameDto } from '../../shared/contracts/dto/GameDto'

const ABSOLUTE_URL = /^https?:\/\//

/**
 * A title as the window may see it.
 *
 * Two decisions live here rather than in the renderer: the box art is resolved
 * against the catalog's base URL, and whether a title can be launched is answered
 * here — so the window never receives a filesystem path it could be talked into
 * opening.
 */
export class GameDtoMapper {
  public toDto (game: Game, catalogBaseUrl: string): GameDto {
    return {
      name: game.name,
      title: game.title,
      platform: game.platform,
      version: game.version,
      mode: game.mode,
      kind: game.kind,
      description: game.description,
      author: game.author,
      imageUrl: this.resolveImageUrl(game, catalogBaseUrl),
      installed: game.installed,
      updateAvailable: game.updateAvailable,
      installedVersion: game.installedVersion,
      launchable: this.isLaunchable(game)
    }
  }

  public toDtoList (games: readonly Game[], catalogBaseUrl: string): readonly GameDto[] {
    return games.map((game: Game): GameDto => this.toDto(game, catalogBaseUrl))
  }

  private resolveImageUrl (game: Game, catalogBaseUrl: string): string | null {
    if (game.imagePath === null) return null
    if (ABSOLUTE_URL.test(game.imagePath)) return game.imagePath
    return catalogBaseUrl.length > 0 ? `${catalogBaseUrl}${game.imagePath}` : null
  }

  private isLaunchable (game: Game): boolean {
    if (!game.installed) return false
    if (game.mode === 'web') return game.hostedUrl !== null
    return game.menuEntryPath !== null || game.executablePath !== null
  }
}
