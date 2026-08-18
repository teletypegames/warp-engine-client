import type { UnavailableReason } from './Game'

/**
 * A catalog entry the store can install here, with the release it chose.
 *
 * `scope` is how the host groups its library — for a desktop that is the catalog
 * platform. It is what `state.json` is keyed by (`<scope>:<name>`), so two scopes
 * can carry a game of the same name without colliding.
 */
export interface SelectedGame {
  readonly name: string
  readonly scope: string
  readonly platform: string
  readonly kind: string
  readonly version: string
  readonly asset: string
  /**
   * The catalog-side path, kept because not every asset is a download: an `html`
   * build is a hosted directory, and the entry is a link to it.
   */
  readonly assetPath: string
  readonly title: string
  readonly description: string
  readonly author: string
  readonly imageUrl: string | null
  readonly createdAt: string | null
  /** `app` for a native archive, `web` for a hosted page. */
  readonly mode: string
}

/**
 * A title the store offers but this machine cannot install.
 *
 * A store that hides these is lying about its catalog by omission: "there is
 * nothing for your machine" is an answer, and an absent entry is not. Titles the
 * store *chooses* not to offer — the wrong status, an `only`/`exclude` list — are
 * not here, because that is editorial rather than a limitation of the machine.
 */
export interface UnavailableEntry {
  readonly name: string
  readonly title: string
  readonly platform: string
  readonly description: string
  readonly author: string
  readonly imageUrl: string | null
  readonly version: string
  readonly reason: UnavailableReason
  /** The sentence behind the code, for a tooltip or the log. */
  readonly detail: string
}

/** What a survey of the catalog found: installable, why not, and what was skipped. */
export interface CatalogSurvey {
  readonly games: readonly SelectedGame[]
  readonly skipped: readonly string[]
  readonly unavailable: readonly UnavailableEntry[]
}
