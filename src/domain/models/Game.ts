/** How a title runs: unpacked on this machine, or served as a web build. */
export type GameMode = 'app' | 'web'

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
}
