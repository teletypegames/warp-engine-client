import type { HostSpecific } from './HostMachine'

/**
 * How one store behaves: what it offers, where things land, how it talks to the API.
 *
 * This is the shape of a store's `config.json` after it has been merged onto the
 * defaults below. On disk the file is snake_case, which is the format the store
 * repositories publish; `StoreConfigurationReader` is the only place that knows it.
 */
export interface StoreConfiguration {
  readonly store: StoreDescriptor
  readonly paths: PathsConfiguration
  readonly install: InstallConfiguration
  readonly catalog: CatalogConfiguration
  /** Platforms this store turns on or off, by name; a platform not named here is carried. */
  readonly platforms: Readonly<Record<string, PlatformConfiguration>>
  readonly behavior: BehaviorConfiguration
}

export interface StoreDescriptor {
  /** Short slug: names the store home, the log prefix and the launcher files. */
  readonly id: string
  /** Human-readable: the Start-menu folder on Windows, and what the user sees. */
  readonly name: string
  readonly baseUrl: string
  readonly api: ApiConfiguration
}

export interface ApiConfiguration {
  readonly catalog: string
  readonly download: string
}

export interface PathsConfiguration {
  /** All null means "work it out from the OS"; set one to pin it. */
  readonly installRoot: string | null
  readonly menuDirectory: string | null
  readonly iconDirectory: string | null
  /**
   * Our own folder inside the install root: the prune boundary, and what keeps two
   * stores on one machine out of each other's files.
   */
  readonly subfolder: string
}

export interface AssetSpecification {
  /** One kind, or several in order of preference. */
  readonly kind: HostSpecific<string | readonly string[]> | null
  readonly extension: HostSpecific<string> | null
}

export interface InstallConfiguration {
  /** Tried in this order; the first that has an asset wins. */
  readonly modes: readonly string[]
  readonly specifications: Readonly<Record<string, AssetSpecification>>
}

export interface CatalogConfiguration {
  /**
   * The catalog statuses to list. Null leaves it to the catalog, whose vocabulary marks
   * the statuses a store lists by default; an empty list means every status.
   */
  readonly statuses: readonly string[] | null
  readonly ownerId: number | null
  readonly only: readonly string[]
  readonly exclude: readonly string[]
}

export interface PlatformConfiguration {
  readonly enabled: boolean
}

export interface BehaviorConfiguration {
  readonly prune: boolean
  /** Seconds. */
  readonly timeout: number
  readonly insecure: boolean
}

export const APP_MODE = 'app'
export const WEB_MODE = 'web'

/**
 * What a store gets when its config says nothing.
 *
 * These were the desktop engine's own defaults, and they stay the defaults: a store
 * that publishes no `config.json` installs on the strength of this table alone, so
 * what a store actually has to supply is identity — a slug, a name and a catalog.
 */
export const DEFAULT_STORE_CONFIGURATION: StoreConfiguration = {
  store: {
    id: 'warp',
    name: 'WarpEngine Store',
    baseUrl: 'https://example.org',
    api: { catalog: '/api/software', download: '/api/download' }
  },
  paths: {
    installRoot: null,
    menuDirectory: null,
    iconDirectory: null,
    subfolder: 'warp'
  },
  install: {
    modes: [APP_MODE, WEB_MODE],
    specifications: {
      // Which asset to unpack, per host. The most specific key wins; a list is
      // tried in order of preference. On Apple Silicon `mac_universal` comes first
      // and `mac_x64` last, because that one needs Rosetta.
      [APP_MODE]: {
        kind: {
          'linux-x86_64': 'linux_x64',
          'linux-aarch64': 'linux_arm64',
          'linux-armhf': 'linux_armhf',
          'linux-x86': 'linux_x86',
          'windows-x86_64': ['win_x64', 'win_x86'],
          'windows-x86': 'win_x86',
          'darwin-aarch64': ['mac_universal', 'mac_arm64', 'mac_x64'],
          'darwin-x86_64': ['mac_universal', 'mac_x64']
        },
        extension: '.zip'
      },
      // A browser build is hosted, not downloaded: there is no archive for it, so
      // the entry opens the published page. It needs the network to play.
      [WEB_MODE]: { kind: 'html', extension: '' }
    }
  },
  catalog: {
    statuses: null,
    ownerId: null,
    only: [],
    exclude: []
  },
  // Which platforms a store carries is the catalog's business, not a list here: a
  // platform the config does not name is carried, so a catalog that gains one needs no
  // new client. Whether a title has anything this machine can run is the asset check's
  // job (a DOS program is a Win32 build on Windows and nothing elsewhere). A store
  // turns a platform off with `{ enabled: false }`.
  platforms: {},
  behavior: { prune: true, timeout: 60, insecure: false }
}
