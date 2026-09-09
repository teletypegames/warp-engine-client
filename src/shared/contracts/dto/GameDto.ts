/** How a title runs: unpacked on this machine, or served as a web build. */
export type GameModeDto = 'app' | 'web'

/**
 * Whether this person can install this title.
 *
 * Separate from `installable`, which is about the machine. A title can have a perfectly
 * good build for this architecture and still not be yours.
 *
 *   - `open`           — nothing to own; install it
 *   - `entitled`       — owned; install it
 *   - `purchasable`    — not owned, and here is the price
 *   - `signInRequired` — the catalog would say, if it knew who was asking
 */
export type AccessVerdictDto = 'open' | 'entitled' | 'purchasable' | 'signInRequired'

/** Why a title cannot be installed on this machine. */
export type UnavailableReasonDto = 'platformOff' | 'hostAsset' | 'noAsset' | 'vetoed'

/**
 * A catalog entry as the window needs it.
 *
 * Deliberately free of filesystem paths: what to launch is resolved in the main
 * process from the store's own state, so the window never learns where anything
 * lives and cannot be talked into opening it.
 */
export interface GameDto {
  readonly name: string
  readonly title: string
  readonly platform: string
  /** The platform's display name, from the catalog; the raw name where it has none. */
  readonly platformLabel: string
  readonly version: string
  readonly mode: GameModeDto
  readonly kind: string
  readonly description: string
  readonly author: string
  /** The catalog's genre, or null where it names none; the category axis of the filter. */
  readonly category: string | null
  /** Absolute, already resolved against the catalog's base URL. */
  readonly imageUrl: string | null
  readonly installed: boolean
  readonly updateAvailable: boolean
  readonly installedVersion: string | null
  readonly launchable: boolean
  /** False for a title this machine cannot install; it is listed all the same. */
  readonly installable: boolean
  readonly unavailableReason: UnavailableReasonDto | null
  readonly unavailableDetail: string | null
  readonly accessVerdict: AccessVerdictDto
  /** Already formatted for the window's locale; null where there is no price to show. */
  readonly priceLabel: string | null
  /** Opened in the person's own browser. Null where the catalog named none. */
  readonly purchaseUrl: string | null
}
