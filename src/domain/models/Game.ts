import type { CatalogAccess } from './CatalogAccess'

/** How a title runs: unpacked on this machine, or served as a web build. */
export type GameMode = 'app' | 'web'

/**
 * Why a title cannot be installed here, as the engine codes it.
 *
 * `platformOff` is the store not carrying that platform at all — a C64 cartridge on a
 * desktop — and the other three are about this machine or this catalog: no asset kind
 * for the os and architecture, no release carrying it, or the adapter refusing it.
 */
export type UnavailableReason = 'platformOff' | 'hostAsset' | 'noAsset' | 'vetoed'

/**
 * A catalog entry, with what the store did about it on this machine.
 *
 * The launch targets live here and nowhere nearer the window: resolving what to
 * open is the main process's job.
 */
export interface Game {
  readonly name: string
  readonly title: string
  readonly platform: string
  /** The platform as the catalog names it for people — "Plus/4" for `plus4`. */
  readonly platformLabel: string
  readonly version: string
  readonly mode: GameMode
  readonly kind: string
  readonly description: string
  readonly author: string
  /** Relative to the catalog's base URL, as published. */
  readonly imagePath: string | null
  readonly installed: boolean
  readonly updateAvailable: boolean
  readonly installedVersion: string | null
  readonly menuEntryPath: string | null
  readonly executablePath: string | null
  readonly hostedUrl: string | null
  /**
   * False for a title this machine cannot install. It is still listed: a catalog that
   * hides what your machine cannot run leaves you wondering which of the two is small.
   */
  readonly installable: boolean
  readonly unavailableReason: UnavailableReason | null
  /** The engine's sentence for it, for a tooltip or the log. */
  readonly unavailableDetail: string | null
  /**
   * What the catalog says about getting it, or null where it said nothing.
   *
   * Kept separate from `installable`: that one is about this machine — no build for
   * this architecture — and this one is about this person. A title can be perfectly
   * installable and still not yours.
   */
  readonly access: CatalogAccess | null
}
