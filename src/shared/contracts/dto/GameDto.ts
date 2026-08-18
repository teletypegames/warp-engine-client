/** How a title runs: unpacked on this machine, or served as a web build. */
export type GameModeDto = 'app' | 'web'

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
  readonly version: string
  readonly mode: GameModeDto
  readonly kind: string
  readonly description: string
  readonly author: string
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
}
