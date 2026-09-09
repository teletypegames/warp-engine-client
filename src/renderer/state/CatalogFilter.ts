import type { GameDto } from '../../shared/contracts/dto/GameDto'
import type { MessageBundle } from '../../shared/i18n/MessageBundle'

/**
 * The four axes the catalog is narrowed along.
 *
 * `group` is the state of a title on this machine and is always set — "everything" is
 * a group. The other three are properties of the title and are optional: null means
 * the axis is not narrowing. The axes combine: a filter is the conjunction of all four,
 * so *Installed* and *Plus/4* together show the installed Plus/4 titles.
 */
export type FilterAxis = 'group' | 'platform' | 'mode' | 'category'

export interface CatalogFilter {
  readonly group: string
  readonly platform: string | null
  readonly mode: string | null
  readonly category: string | null
}

/** One choice on one axis, with how many titles it would show. */
export interface FilterOption {
  readonly axis: FilterAxis
  readonly value: string
  readonly label: string
  readonly count: number
  readonly active: boolean
}

/**
 * One axis as drawn: a titled block of options.
 *
 * `exclusive` axes are the ones where exactly one option is on — the status group; the
 * others toggle, and turning the active one off widens the filter again.
 */
export interface FilterSection {
  readonly axis: FilterAxis
  readonly title: string
  readonly exclusive: boolean
  readonly options: readonly FilterOption[]
}

export const EVERYTHING: CatalogFilter = { group: 'all', platform: null, mode: null, category: null }

const GROUPS = ['all', 'installed', 'updates', 'available', 'owned', 'purchasable', 'unsupported'] as const

export function isEverything (filter: CatalogFilter): boolean {
  return filter.group === 'all' && filter.platform === null && filter.mode === null && filter.category === null
}

export function matchesFilter (game: GameDto, filter: CatalogFilter): boolean {
  if (!matchesGroup(game, filter.group)) return false
  if (filter.platform !== null && game.platform !== filter.platform) return false
  // A title this machine cannot install has no mode worth filtering on: the engine
  // sends none, and counting it as native would put a C64 cartridge under "native".
  if (filter.mode !== null && !(game.installable && game.mode === filter.mode)) return false
  if (filter.category !== null && game.category !== filter.category) return false
  return true
}

/**
 * The filter after a click on one option.
 *
 * The group always takes the value — one of them is on at all times. The other axes
 * toggle: clicking the active platform clears the platform, so the chip is its own
 * off switch and the menu needs no separate "any platform" entry.
 */
export function toggleOption (filter: CatalogFilter, axis: FilterAxis, value: string): CatalogFilter {
  switch (axis) {
    case 'group':
      return { ...filter, group: value }
    case 'platform':
      return { ...filter, platform: filter.platform === value ? null : value }
    case 'mode':
      return { ...filter, mode: filter.mode === value ? null : value }
    case 'category':
      return { ...filter, category: filter.category === value ? null : value }
  }
}

/**
 * The sections, built from what the catalog actually contains.
 *
 * Every count is faceted: it says how many titles the option would show *given the
 * other axes as they are now*, which is the number a person is asking about when they
 * look at a chip. An axis with fewer than two values is left out — a filter that
 * changes nothing is noise — and so is an option that would show nothing, except on the
 * group axis, whose entries are a fixed vocabulary and read better complete.
 */
export function buildFilterSections (
  games: readonly GameDto[],
  filter: CatalogFilter,
  messages: MessageBundle
): readonly FilterSection[] {
  const countWith = (axis: FilterAxis, value: string): number =>
    games.filter((game: GameDto): boolean => matchesFilter(game, withAxis(filter, axis, value))).length
  const option = (axis: FilterAxis, value: string, label: string, active: boolean): FilterOption =>
    ({ axis, value, label, count: countWith(axis, value), active })

  const sections: FilterSection[] = []

  const groups = GROUPS.map((group: string): FilterOption =>
    option('group', group, describeGroup(group, messages), filter.group === group))
  sections.push({
    axis: 'group',
    title: messages.catState,
    exclusive: true,
    options: groups.filter((item: FilterOption): boolean =>
      item.value === 'all' || item.active || countAll(games, item.value) > 0)
  })

  const platforms = new Map<string, string>()
  for (const game of games) {
    if (game.platform.length > 0 && !platforms.has(game.platform)) platforms.set(game.platform, game.platformLabel)
  }
  if (platforms.size > 1) {
    sections.push({
      axis: 'platform',
      title: messages.catPlatform,
      exclusive: false,
      options: sortByLabel([...platforms.entries()].map(([value, label]: readonly [string, string]): FilterOption =>
        option('platform', value, label, filter.platform === value)))
    })
  }

  const modes = new Set(games
    .filter((game: GameDto): boolean => game.installable)
    .map((game: GameDto): string => game.mode))
  if (modes.size > 1) {
    sections.push({
      axis: 'mode',
      title: messages.catMode,
      exclusive: false,
      options: [...modes].map((mode: string): FilterOption =>
        option('mode', mode, mode === 'web' ? messages.hosted : messages.native, filter.mode === mode))
    })
  }

  const categories = new Set(games
    .map((game: GameDto): string | null => game.category)
    .filter((category: string | null): category is string => category !== null))
  if (categories.size > 0) {
    sections.push({
      axis: 'category',
      title: messages.catCategory,
      exclusive: false,
      options: sortByLabel([...categories].map((category: string): FilterOption =>
        option('category', category, category, filter.category === category)))
    })
  }

  return sections
}

/**
 * A filter can outlive what it points at — the last title of a platform is removed,
 * an update is applied — and an axis narrowing to nothing that exists would look like
 * an empty catalog. Each such axis falls back to "any"; the rest of the filter stands.
 * Returns the same object when nothing had to change, so a caller can compare by
 * identity.
 */
export function resolveFilter (filter: CatalogFilter, games: readonly GameDto[]): CatalogFilter {
  const has = (predicate: (game: GameDto) => boolean): boolean => games.some(predicate)
  const resolved: CatalogFilter = {
    group: GROUPS.some((group: string): boolean => group === filter.group) ? filter.group : 'all',
    platform: filter.platform !== null && has((game: GameDto): boolean => game.platform === filter.platform)
      ? filter.platform
      : null,
    mode: filter.mode !== null && has((game: GameDto): boolean => game.installable && game.mode === filter.mode)
      ? filter.mode
      : null,
    category: filter.category !== null && has((game: GameDto): boolean => game.category === filter.category)
      ? filter.category
      : null
  }
  return isSameFilter(filter, resolved) ? filter : resolved
}

function isSameFilter (left: CatalogFilter, right: CatalogFilter): boolean {
  return left.group === right.group && left.platform === right.platform &&
    left.mode === right.mode && left.category === right.category
}

function withAxis (filter: CatalogFilter, axis: FilterAxis, value: string): CatalogFilter {
  switch (axis) {
    case 'group':
      return { ...filter, group: value }
    case 'platform':
      return { ...filter, platform: value }
    case 'mode':
      return { ...filter, mode: value }
    case 'category':
      return { ...filter, category: value }
  }
}

function countAll (games: readonly GameDto[], group: string): number {
  return games.filter((game: GameDto): boolean => matchesGroup(game, group)).length
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
      // group is finding what you paid for and have not put on this machine yet.
      return game.accessVerdict === 'entitled'
    case 'purchasable':
      return game.accessVerdict === 'purchasable'
    case 'unsupported':
      return !game.installable
    default:
      return true
  }
}

function describeGroup (group: string, messages: MessageBundle): string {
  switch (group) {
    case 'installed':
      return messages.catInstalled
    case 'updates':
      return messages.catUpdates
    case 'available':
      return messages.catAvailable
    case 'owned':
      return messages.catOwned
    case 'purchasable':
      return messages.catPurchasable
    case 'unsupported':
      return messages.catUnsupported
    default:
      return messages.catAll
  }
}

function sortByLabel (options: readonly FilterOption[]): readonly FilterOption[] {
  return [...options].sort((left: FilterOption, right: FilterOption): number =>
    left.label.localeCompare(right.label))
}
