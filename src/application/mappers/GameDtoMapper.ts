import { readAccessVerdict, type CatalogPrice } from '../../domain/models/CatalogAccess'
import type { Game } from '../../domain/models/Game'
import type { GameDto } from '../../shared/contracts/dto/GameDto'

const ABSOLUTE_URL = /^https?:\/\//

/**
 * A title as the window may see it.
 *
 * Three decisions live here rather than in the renderer: the box art is resolved
 * against the catalog's base URL, whether a title can be launched is answered here —
 * so the window never receives a filesystem path it could be talked into opening —
 * and the catalog's access block is reduced to a verdict and a printed price, because
 * a view that had to reason about entitlement is a view with a rule in it.
 */
export class GameDtoMapper {
  public toDto (game: Game, catalogBaseUrl: string): GameDto {
    return {
      name: game.name,
      title: game.title,
      platform: game.platform,
      platformLabel: game.platformLabel,
      version: game.version,
      mode: game.mode,
      kind: game.kind,
      description: game.description,
      author: game.author,
      imageUrl: this.resolveImageUrl(game, catalogBaseUrl),
      installed: game.installed,
      updateAvailable: game.updateAvailable,
      installedVersion: game.installedVersion,
      launchable: this.isLaunchable(game),
      installable: game.installable,
      unavailableReason: game.unavailableReason,
      unavailableDetail: game.unavailableDetail,
      accessVerdict: readAccessVerdict(game.access),
      priceLabel: formatPrice(game.access?.price ?? null),
      purchaseUrl: game.access?.purchaseUrl ?? null
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

/**
 * A price as a person reads it, in the currency the catalog named.
 *
 * `Intl` with the *catalog's* currency and the system locale: the store decides what it
 * charges in, the reader's machine decides where the symbol and the separators go.
 * There is no conversion here and there must not be — inventing an exchange rate would
 * be quoting a price nobody agreed to.
 */
function formatPrice (price: CatalogPrice | null): string | null {
  if (price === null) return null
  if (price.amountCents <= 0) return null

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: price.currency
    }).format(price.amountCents / 100)
  } catch {
    // An unknown currency code: better the number and the code than nothing at all.
    return `${(price.amountCents / 100).toFixed(2)} ${price.currency}`
  }
}
