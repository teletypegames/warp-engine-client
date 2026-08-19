import type { CatalogAccess } from '../../../domain/models/CatalogAccess'
import type { SupportedWarpEngineVersion } from '../../../domain/models/WarpEngineVersion'

/**
 * How one WarpEngine version's catalog is shaped.
 *
 * The catalog is the one thing this client reads that it does not own the shape of, so
 * it is the one thing an engine version can change under it. A dialect turns that
 * foreign JSON into the typed records below, and everything downstream — the survey,
 * the release choice — sees only those. When a future engine renames a field or nests a
 * release differently, a new dialect is the whole change.
 */
export interface CatalogDialect {
  readonly version: SupportedWarpEngineVersion
  /** One entry per title in the catalog. */
  listEntries: (catalog: unknown) => readonly CatalogEntry[]
}

export interface CatalogEntry {
  readonly software: CatalogSoftware
  /**
   * What the catalog says about getting this title, or null where it says nothing.
   *
   * Null is not "free": it is an engine too old to have an opinion, and a store that
   * never gated anything reads the same as one that could not say. Both mean the same
   * thing in practice — try the download — but only one of them is worth offering a
   * sign-in for.
   */
  readonly access: CatalogAccess | null
  /**
   * The release the catalog itself calls newest-and-stable, or null when it names none.
   *
   * Kept separate from the candidates because it is also what an unavailable title's
   * card shows a version from — and a catalog with releases but no `latestRelease` has
   * nothing to show there.
   */
  readonly latestRelease: CatalogRelease | null
  /**
   * Every release worth trying, newest first and deduplicated.
   *
   * `latestRelease` comes first where there is one, then the rest, so that a game whose
   * newest build is missing an asset still installs from an older one.
   */
  readonly releaseCandidates: readonly CatalogRelease[]
}

export interface CatalogSoftware {
  readonly name: string
  readonly title: string
  readonly platform: string
  readonly status: string
  readonly description: string
  readonly author: string
  readonly imageUrl: string | null
}

export interface CatalogRelease {
  readonly version: string
  readonly createdAt: string | null
  readonly assets: readonly CatalogAsset[]
}

export interface CatalogAsset {
  readonly kind: string
  readonly path: string
}
