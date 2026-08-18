/**
 * A store engine this client knows how to drive.
 *
 * There is one today. The table exists because the RetroArch store has the same
 * command shape, so a second entry — not a second code path — is what adding it
 * would take.
 */
export interface StoreEngine {
  readonly id: string
  readonly scriptFileName: string
  /** The installer names a store home `<store id><homeSuffix>`. */
  readonly homeSuffix: string
  readonly launcherSuffix: string
}

export const DESKTOP_STORE_ENGINE: StoreEngine = {
  id: 'desktop',
  scriptFileName: 'desktop_store.py',
  homeSuffix: '-desktop',
  launcherSuffix: '-desktop-store'
}

export const STORE_ENGINES: readonly StoreEngine[] = [DESKTOP_STORE_ENGINE]
