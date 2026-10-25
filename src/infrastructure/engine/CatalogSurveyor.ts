import { describeHost, resolveForHost, type HostMachine } from '../../domain/models/HostMachine'
import type { UnavailableReason } from '../../domain/models/Game'
import { gameKey } from '../../domain/models/InstalledRecord'
import type {
  CatalogSurvey, SelectedGame, UnavailableEntry
} from '../../domain/models/SelectedGame'
import type { AssetSpecification, StoreConfiguration } from '../../domain/models/StoreConfiguration'
import type { CatalogEntry, CatalogSoftware } from './dialects/CatalogDialect'
import { pickRelease } from './ReleasePicker'

/**
 * The catalog, turned into what this machine can and cannot install.
 *
 * Two decisions layered on each other. The inner one asks, per install mode, "which
 * titles have *this* asset for this host"; the outer one asks it once per mode and
 * merges the answers in the config's mode order, so a title with no native build for
 * this machine is still installable as a hosted page. That fallback is what makes a
 * desktop store the only one that can carry the whole catalog.
 *
 * A title counts as unavailable only when every mode failed it, and then the *first*
 * mode's verdict is the one kept: `app` comes first, so a person is told "no native
 * build for this machine" rather than the web mode's complaint about the same title.
 *
 * The entries arrive already typed, from whichever `CatalogDialect` the serving engine
 * version selected — nothing here knows what the catalog's JSON looks like. The statuses
 * arrive resolved too: the config's own list, or the catalog's vocabulary's.
 */
export class CatalogSurveyor {
  public constructor (
    private readonly configuration: StoreConfiguration,
    private readonly log: (line: string) => void
  ) {}

  public survey (
    entries: readonly CatalogEntry[],
    host: HostMachine,
    statuses: readonly string[]
  ): CatalogSurvey {
    const chosen = new Map<string, SelectedGame>()
    const unmet = new Map<string, UnavailableEntry>()
    const reasonsByName = new Map<string, string[]>()

    for (const mode of this.configuration.install.modes) {
      const specification = this.configuration.install.specifications[mode]
      if (specification === undefined) {
        this.log(`warning: install mode '${mode}' has no asset spec — ignoring it`)
        continue
      }
      const pass = this.surveyMode(entries, host, mode, specification, statuses)

      for (const game of pass.games) {
        const key = gameKey(game)
        if (!chosen.has(key)) chosen.set(key, game)
      }
      for (const [name, reason] of pass.reasons) {
        const collected = reasonsByName.get(name) ?? []
        collected.push(`${mode}: ${reason}`)
        reasonsByName.set(name, collected)
      }
      for (const entry of pass.unavailable) {
        if (!unmet.has(entry.name)) unmet.set(entry.name, entry)
      }
    }

    // A title that some later mode could serve is not skipped at all: nobody needs to
    // hear that the native build was missing when the game installed anyway.
    const installedNames = new Set([...chosen.values()].map((game: SelectedGame): string => game.name))
    const skipped = [...reasonsByName.entries()]
      .filter(([name]: readonly [string, readonly string[]]): boolean => !installedNames.has(name))
      .map(([name, reasons]: readonly [string, readonly string[]]): string =>
        `${name}: ${reasons.join('; ')}`)

    return {
      games: [...chosen.values()],
      skipped,
      unavailable: [...unmet.values()]
        .filter((entry: UnavailableEntry): boolean => !installedNames.has(entry.name))
    }
  }

  /** One pass over the catalog, asking for one mode's asset. */
  private surveyMode (
    entries: readonly CatalogEntry[],
    host: HostMachine,
    mode: string,
    specification: AssetSpecification,
    listedStatuses: readonly string[]
  ): ModeSurvey {
    const { statuses, only, exclude } = this.filters(listedStatuses)
    const games: SelectedGame[] = []
    const reasons: [string, string][] = []
    const unavailable: UnavailableEntry[] = []

    for (const entry of entries) {
      const software = entry.software
      const name = software.name

      // Editorial filters: a title excluded here is in none of the three lists, because
      // that is the store's choice rather than a limit of the machine.
      if (statuses.size > 0 && !statuses.has(software.status.toLowerCase())) continue
      if (only.size > 0 && !only.has(name.toLowerCase())) continue
      if (exclude.has(name.toLowerCase())) continue

      const platform = this.configuration.platforms[software.platform]
      if (platform?.enabled !== true) {
        // Reported rather than hidden: to somebody looking at a catalog, a platform
        // switched off reads as "not supported here".
        unavailable.push(toUnavailable(entry, 'platformOff',
          `${software.platform} is not carried by this store`))
        continue
      }

      const wanted = readKinds(resolveForHost(specification.kind, host))
      if (wanted.length === 0) {
        const reason = `${software.platform} has no asset kind for ${describeHost(host)}`
        reasons.push([name, reason])
        unavailable.push(toUnavailable(entry, 'hostAsset', reason))
        continue
      }
      const extension = resolveForHost(specification.extension, host) ?? ''

      const release = pickRelease(entry.releaseCandidates, wanted, extension)
      if (release === null) {
        const reason = `no '${wanted.join('/')}' asset in any release`
        reasons.push([name, reason])
        unavailable.push(toUnavailable(entry, 'noAsset', reason))
        continue
      }

      games.push({
        name,
        scope: software.platform,
        platform: software.platform,
        kind: release.kind,
        version: release.version,
        asset: release.assetName,
        assetPath: release.assetPath,
        title: software.title,
        description: software.description,
        author: software.author,
        category: software.category,
        imageUrl: software.imageUrl,
        createdAt: release.createdAt,
        mode,
        access: entry.access
      })
    }
    return { games, reasons, unavailable }
  }

  private filters (statuses: readonly string[]): CatalogFilters {
    const lower = (values: readonly string[]): ReadonlySet<string> =>
      new Set(values.map((value: string): string => value.toLowerCase()))
    return {
      statuses: lower(statuses),
      only: lower(this.configuration.catalog.only),
      exclude: lower(this.configuration.catalog.exclude)
    }
  }
}

interface CatalogFilters {
  readonly statuses: ReadonlySet<string>
  readonly only: ReadonlySet<string>
  readonly exclude: ReadonlySet<string>
}

interface ModeSurvey {
  readonly games: readonly SelectedGame[]
  /** `[name, reason]`, kept per name so several modes' complaints can be joined. */
  readonly reasons: readonly (readonly [string, string])[]
  readonly unavailable: readonly UnavailableEntry[]
}

/** One unavailable record, with enough for a client to draw a card. */
function toUnavailable (
  entry: CatalogEntry,
  reason: UnavailableReason,
  detail: string
): UnavailableEntry {
  const software: CatalogSoftware = entry.software
  return {
    access: entry.access,
    name: software.name,
    title: software.title,
    platform: software.platform,
    description: software.description,
    author: software.author,
    category: software.category,
    imageUrl: software.imageUrl,
    version: entry.latestRelease?.version ?? '',
    reason,
    detail
  }
}

function readKinds (value: string | readonly string[] | null): readonly string[] {
  if (value === null) return []
  const kinds = typeof value === 'string' ? [value] : value
  return kinds.filter((kind: string): boolean => kind.length > 0)
}
