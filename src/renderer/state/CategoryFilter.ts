import type { GameDto } from '../../shared/contracts/dto/GameDto'
import type { MessageBundle } from '../../shared/i18n/MessageBundle'

/** Which axis a category narrows the grid along. */
export type CategoryKind = 'group' | 'platform' | 'mode'

export interface CategoryFilter {
  readonly kind: CategoryKind
  readonly value: string
}

export interface CategoryItem extends CategoryFilter {
  readonly label: string
  readonly count: number
}

export interface CategorySection {
  readonly title: string | null
  readonly items: readonly CategoryItem[]
}

export const ALL_CATEGORIES: CategoryFilter = { kind: 'group', value: 'all' }

export function isSameFilter (left: CategoryFilter, right: CategoryFilter): boolean {
  return left.kind === right.kind && left.value === right.value
}

export function matchesFilter (game: GameDto, filter: CategoryFilter): boolean {
  switch (filter.kind) {
    case 'platform':
      return game.platform === filter.value
    case 'mode':
      // A title this machine cannot install has no mode worth filtering on: the engine
      // sends none, and counting it as native would put a C64 cartridge under "native".
      return game.installable && game.mode === filter.value
    case 'group':
      return matchesGroup(game, filter.value)
  }
}

function matchesGroup (game: GameDto, group: string): boolean {
  switch (group) {
    case 'installed':
      return game.installed
    case 'updates':
      return game.updateAvailable
    case 'available':
      return game.installable && !game.installed
    case 'owned':
      // Owning something is not the same as having installed it — the point of the
      // category is finding what you paid for and have not put on this machine yet.
      return game.accessVerdict === 'entitled'
    case 'purchasable':
      return game.accessVerdict === 'purchasable'
    case 'unsupported':
      return !game.installable
    default:
      return true
  }
}

/**
 * The categories, built from what the catalog actually contains.
 *
 * There is no genre in a WarpEngine catalog, so the useful axes are the state of a
 * title on this machine, what this person may have of it, the platform it was built
 * with, and whether it runs here or in a browser. Empty axes are left out rather than shown as zeroes, and an axis with
 * a single value is left out too — a filter that changes nothing is noise.
 */
export function buildCategorySections (
  games: readonly GameDto[],
  messages: MessageBundle
): readonly CategorySection[] {
  const count = (predicate: (game: GameDto) => boolean): number => games.filter(predicate).length
  const sections: CategorySection[] = []

  const groups: readonly CategoryItem[] = [
    { kind: 'group', value: 'all', label: messages.catAll, count: games.length },
    { kind: 'group', value: 'installed', label: messages.catInstalled, count: count((game: GameDto): boolean => game.installed) },
    { kind: 'group', value: 'updates', label: messages.catUpdates, count: count((game: GameDto): boolean => game.updateAvailable) },
    { kind: 'group', value: 'available', label: messages.catAvailable, count: count((game: GameDto): boolean => game.installable && !game.installed) },
    { kind: 'group', value: 'owned', label: messages.catOwned, count: count((game: GameDto): boolean => game.accessVerdict === 'entitled') },
    { kind: 'group', value: 'purchasable', label: messages.catPurchasable, count: count((game: GameDto): boolean => game.accessVerdict === 'purchasable') },
    { kind: 'group', value: 'unsupported', label: messages.catUnsupported, count: count((game: GameDto): boolean => !game.installable) }
  ]
  sections.push({
    title: null,
    items: groups.filter((item: CategoryItem): boolean => item.value === 'all' || item.count > 0)
  })

  const labels = new Map<string, string>()
  for (const game of games) {
    if (game.platform.length > 0 && !labels.has(game.platform)) labels.set(game.platform, game.platformLabel)
  }
  const platforms = [...labels.keys()]
    .sort((left: string, right: string): number =>
      (labels.get(left) ?? left).localeCompare(labels.get(right) ?? right))
  if (platforms.length > 1) {
    sections.push({
      title: messages.catPlatform,
      items: platforms.map((platform: string): CategoryItem => ({
        kind: 'platform',
        value: platform,
        label: labels.get(platform) ?? platform,
        count: count((game: GameDto): boolean => game.platform === platform)
      }))
    })
  }

  const installable = games.filter((game: GameDto): boolean => game.installable)
  const modes = [...new Set(installable.map((game: GameDto): string => game.mode))]
  if (modes.length > 1) {
    sections.push({
      title: messages.catMode,
      items: modes.map((mode: string): CategoryItem => ({
        kind: 'mode',
        value: mode,
        label: mode === 'web' ? messages.hosted : messages.native,
        count: count((game: GameDto): boolean => game.installable && game.mode === mode)
      }))
    })
  }

  return sections
}

/**
 * A category can vanish under us — the last title of a platform is removed, or an
 * update is applied — and a filter matching nothing would look like an empty
 * catalog. Falling back to everything is the honest answer.
 */
export function resolveFilter (
  filter: CategoryFilter,
  sections: readonly CategorySection[]
): CategoryFilter {
  const known = sections
    .flatMap((section: CategorySection): readonly CategoryItem[] => section.items)
    .some((item: CategoryItem): boolean => isSameFilter(item, filter))
  return known ? filter : ALL_CATEGORIES
}
