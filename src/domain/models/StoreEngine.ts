/**
 * A store engine this client knows how to drive.
 *
 * There is one today: the desktop engine, which is the code in
 * `infrastructure/engine`. The table stays because a second host — RetroArch
 * playlists rather than menu entries — would be a second entry and a second
 * `StoreCatalogGateway`, not a second code path through the application.
 *
 * `homeSuffix` is load-bearing rather than cosmetic: it is how an existing store
 * home is recognised, so it has to keep saying `-desktop`.
 */
export interface StoreEngine {
  readonly id: string
  /** The installer names a store home `<store id><homeSuffix>`. */
  readonly homeSuffix: string
  readonly launcherSuffix: string
}

export const DESKTOP_STORE_ENGINE: StoreEngine = {
  id: 'desktop',
  homeSuffix: '-desktop',
  launcherSuffix: '-desktop-store'
}

export const STORE_ENGINES: readonly StoreEngine[] = [DESKTOP_STORE_ENGINE]
