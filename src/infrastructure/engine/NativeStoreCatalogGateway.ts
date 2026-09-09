import path from 'node:path'
import type { CatalogListing } from '../../domain/models/CatalogListing'
import type { DesktopLayout } from '../../domain/models/DesktopLayout'
import type { EngineProgressListener } from '../../domain/models/EngineProgress'
import type { Game, GameMode } from '../../domain/models/Game'
import {
  gameKey, limitToNames, matchStateKeys, type InstalledRecord
} from '../../domain/models/InstalledRecord'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import type {
  CatalogSurvey, SelectedGame, UnavailableEntry
} from '../../domain/models/SelectedGame'
import type { ServiceDescriptor } from '../../domain/models/ServiceDescriptor'
import type { SignInPrompt, StoreAccount } from '../../domain/models/StoreAccount'
import { APP_MODE, WEB_MODE, type StoreConfiguration } from '../../domain/models/StoreConfiguration'
import type { StorePaths } from '../../domain/models/StorePaths'
import type { CredentialRepository } from '../../domain/ports/CredentialRepository'
import type { InstalledStoreRepository } from '../../domain/ports/InstalledStoreRepository'
import type { SignInPollResult, StoreCatalogGateway } from '../../domain/ports/StoreCatalogGateway'
import { StoreFileSystem } from '../files/StoreFileSystem'
import { CatalogClient, type FetchedCatalog } from './CatalogClient'
import { CatalogSurveyor } from './CatalogSurveyor'
import type { CatalogEntry } from './dialects/CatalogDialect'
import { selectCatalogDialect } from './dialects/CatalogDialectSelector'
import { DesktopLayoutResolver } from './DesktopLayoutResolver'
import { DeviceSignInClient } from './DeviceSignInClient'
import { GameInstaller } from './GameInstaller'
import { HostMachineDetector } from './HostMachineDetector'
import { LauncherWriter } from './launchers/LauncherWriter'
import { PayloadInstaller } from './PayloadInstaller'
import { PlatformLabelsClient, type PlatformLabels } from './PlatformLabelsClient'
import { ServiceDescriptorClient } from './ServiceDescriptorClient'
import { StoreConfigurationReader } from './StoreConfigurationReader'
import { StoreStateRepository } from './StoreStateRepository'

const STATE_FILE_NAME = 'state.json'
const CATALOG_CACHE_FILE_NAME = 'catalog.json'
const PLATFORM_LABELS_CACHE_FILE_NAME = 'platforms.json'

/**
 * The store engine, in process.
 *
 * This is the whole of what used to be `desktop_store.py` and `warpstore.py` driven
 * as a child process: the catalog, the release choice, the host match, the unpacking,
 * the menu entry and the state. Nothing is serialised to JSON lines and parsed back,
 * so the progress events below are the typed events the window already expects, and
 * a `Game` is built rather than read out of somebody else's field names.
 *
 * What has *not* changed is what lands on disk. `config.json` and `state.json` keep
 * the shell engine's snake_case shape, so a machine whose library was installed by
 * the CLI keeps it.
 */
export class NativeStoreCatalogGateway implements StoreCatalogGateway {
  private readonly hosts = new HostMachineDetector()

  /**
   * The credentials are injected because they are the host's to keep: on a desktop the
   * OS keychain, in the smoke test a map in memory. Nothing here knows which.
   */
  public constructor (
    private readonly credentials: CredentialRepository = NO_CREDENTIALS,
    private readonly stores: InstalledStoreRepository = NO_STORES
  ) {}

  public async listGames (
    store: InstalledStore,
    progress: EngineProgressListener = {}
  ): Promise<CatalogListing> {
    const engine = this.openStore(store, progress)
    const host = this.hosts.findHost()
    engine.log(`host: ${host.operatingSystem}/${host.architecture}`)

    const [ descriptor, entries, labels ] = await Promise.all([
      engine.service.fetchDescriptor(), this.readEntries(engine), engine.platforms.fetchLabels()
    ])
    const survey = engine.surveyor.survey(entries, host)
    const installed = engine.state.readState()

    // One list, both kinds: a client that hides what it cannot install leaves the
    // visitor wondering whether the catalog is small or their machine is unusual.
    const games = [
      ...survey.games.map((game: SelectedGame): Game => this.toGame(engine, game, installed, labels)),
      ...survey.unavailable.map((entry: UnavailableEntry): Game => toUnavailableGame(entry, labels))
    ].sort((left: Game, right: Game): number =>
      left.title.toLowerCase().localeCompare(right.title.toLowerCase()))

    return {
      games,
      skipped: survey.skipped,
      paths: this.toPaths(engine),
      account: toAccount(descriptor, this.credentials.readToken(store.id))
    }
  }

  /**
   * Where this store's things go.
   *
   * Synchronous work behind an async port, which is deliberate: the port was shaped
   * for a child process and stays shaped for one, so a future engine that has to go
   * to the network for this needs no change above.
   */
  public readPaths (
    store: InstalledStore,
    progress: EngineProgressListener = {}
  ): Promise<StorePaths> {
    return Promise.resolve(this.toPaths(this.openStore(store, progress)))
  }

  public async syncGames (
    store: InstalledStore,
    names: readonly string[],
    progress: EngineProgressListener = {}
  ): Promise<void> {
    const engine = this.openStore(store, progress)
    const survey: CatalogSurvey = engine.surveyor.survey(
      await this.readEntries(engine), this.hosts.findHost())
    for (const reason of survey.skipped) engine.log(`skipped ${reason}`)

    const wanted = names.length > 0 ? limitToNames(survey.games, names) : survey.games
    const installed = engine.state.readState()
    // Pruning is for a full sync only: asked for two titles, the store must not take
    // the absence of the rest as a reason to uninstall them.
    const prune = engine.configuration.behavior.prune && names.length === 0

    const changed = await engine.installer.installAll(
      engine.layout, wanted, installed, prune, progress)
    engine.state.writeState(installed)
    if (!changed) {
      engine.log('already up to date')
      return
    }
    engine.launchers.refreshMenu(engine.layout)
    engine.log(`done — the games are in ${engine.layouts.menuGroup(engine.layout)}`)
  }

  public removeGame (
    store: InstalledStore,
    name: string,
    progress: EngineProgressListener = {}
  ): Promise<void> {
    const engine = this.openStore(store, progress)
    const installed = engine.state.readState()
    const keys = matchStateKeys(installed, [name])
    if (keys.length === 0) {
      engine.log(`not installed: ${name}`)
      return Promise.resolve()
    }
    for (const key of keys) {
      const record = installed.get(key)
      if (record === undefined) continue
      engine.installer.removeGame(engine.layout, record)
      progress.onEvent?.({ event: 'removed', name: record.name })
      installed.delete(key)
    }
    engine.state.writeState(installed)
    engine.launchers.refreshMenu(engine.layout)
    return Promise.resolve()
  }

  /**
   * Take a whole store off this machine.
   *
   * The order is the whole of it. `state.json` is the only record of what this store
   * put where — which payload, which icon, which menu entry — so the games have to go
   * *before* the home does. Delete the home first and every one of those files is an
   * orphan nothing will ever be able to identify, least of all a later install of the
   * same store into the same folder.
   *
   * The token goes too: a credential for a store that is no longer here is a secret
   * kept for nothing.
   */
  public removeStore (store: InstalledStore, progress: EngineProgressListener = {}): Promise<void> {
    const engine = this.openStore(store, progress)
    const installed = engine.state.readState()
    const count = installed.size

    engine.installer.purge(engine.layout, installed)
    engine.state.writeState(installed)
    engine.launchers.refreshMenu(engine.layout)
    engine.log(`removed ${String(count)} installed title(s)`)

    this.credentials.clearToken(store.id)
    this.stores.removeHome(store.home)
    engine.log(`removed the store home ${store.home}`)
    return Promise.resolve()
  }

  public async readAccount (store: InstalledStore): Promise<StoreAccount> {
    const engine = this.openStore(store, {})
    const descriptor = await engine.service.fetchDescriptor()
    return toAccount(descriptor, this.credentials.readToken(store.id))
  }

  public async requestSignIn (store: InstalledStore, clientName: string): Promise<SignInPrompt> {
    const { client } = await this.openSignIn(store)
    const requested = await client.requestCode(clientName)
    return {
      deviceCode: requested.deviceCode,
      userCode: requested.userCode,
      verificationUrl: requested.verificationUrl,
      intervalSeconds: requested.intervalSeconds,
      expiresInSeconds: requested.expiresInSeconds
    }
  }

  /**
   * One poll. The token is written here, on the single answer that carries it — a
   * caller that had to remember to save it would eventually forget.
   */
  public async pollSignIn (store: InstalledStore, deviceCode: string): Promise<SignInPollResult> {
    const { client, descriptor, log } = await this.openSignIn(store)
    const result = await client.poll(deviceCode)
    if (result.state === 'approved' && result.token !== null) {
      this.credentials.writeToken(store.id, result.token)
      log('signed in')
    }
    return {
      state: result.state,
      account: toAccount(descriptor, this.credentials.readToken(store.id))
    }
  }

  /**
   * Sign out: tell the server, then forget the token locally regardless.
   *
   * The local half is what matters and must not depend on the network — somebody
   * signing out on a train has to actually be signed out.
   */
  public async signOut (store: InstalledStore): Promise<StoreAccount> {
    const engine = this.openStore(store, {})
    const descriptor = await engine.service.fetchDescriptor()
    if (descriptor.auth !== null && this.credentials.readToken(store.id) !== null) {
      await new DeviceSignInClient(engine.catalog.httpClient(), descriptor.auth.device).revoke()
    }
    this.credentials.clearToken(store.id)
    engine.log('signed out')
    return toAccount(descriptor, null)
  }

  /** The sign-in client for one store, or a clear error if the store offers none. */
  private async openSignIn (store: InstalledStore): Promise<SignInContext> {
    const engine = this.openStore(store, {})
    const descriptor = await engine.service.fetchDescriptor()
    if (descriptor.auth === null) {
      throw new Error(`${store.name} does not offer signing in`)
    }
    return {
      client: new DeviceSignInClient(engine.catalog.httpClient(), descriptor.auth.device),
      descriptor,
      log: engine.log
    }
  }

  /**
   * Fetch the catalog and read it with the dialect its engine version calls for.
   *
   * This is the one place a WarpEngine version turns into behaviour: the header decides
   * which dialect parses the response, and everything downstream sees typed entries.
   */
  private async readEntries (engine: StoreEngineContext): Promise<readonly CatalogEntry[]> {
    const fetched: FetchedCatalog = await engine.catalog.fetchCatalog()
    return selectCatalogDialect(fetched.engineVersion.resolved).listEntries(fetched.catalog)
  }

  /**
   * Assemble the engine for one store.
   *
   * Per call rather than cached: the config on disk is the authority and the user may
   * have edited it, and a store's home is cheap to read.
   */
  private openStore (store: InstalledStore, progress: EngineProgressListener): StoreEngineContext {
    const log = (line: string): void => { progress.onLog?.(`[${store.id}-store] ${line}`) }
    const files = new StoreFileSystem(`${store.id}-store`, log)
    const configuration = new StoreConfigurationReader(files).readConfiguration(store.configPath)

    const layouts = new DesktopLayoutResolver(configuration, this.hosts)
    const layout = layouts.resolveLayout()
    const catalog = new CatalogClient(
      configuration, files, path.join(store.home, CATALOG_CACHE_FILE_NAME), log,
      (): string | null => this.credentials.readToken(store.id))
    const launchers = new LauncherWriter(configuration, layouts, files, log)

    return {
      configuration,
      layout,
      layouts,
      catalog,
      launchers,
      log,
      service: new ServiceDescriptorClient(catalog.httpClient(), configuration.store.baseUrl, log),
      platforms: new PlatformLabelsClient(
        catalog.httpClient(), configuration.store.baseUrl, files,
        path.join(store.home, PLATFORM_LABELS_CACHE_FILE_NAME), log),
      surveyor: new CatalogSurveyor(configuration, log),
      state: new StoreStateRepository(files, path.join(store.home, STATE_FILE_NAME), log),
      installer: new GameInstaller(
        configuration, layouts,
        new PayloadInstaller(catalog, files, log),
        launchers, catalog, files, log)
    }
  }

  private toGame (
    engine: StoreEngineContext,
    game: SelectedGame,
    installed: ReadonlyMap<string, InstalledRecord>,
    labels: PlatformLabels
  ): Game {
    const record = installed.get(gameKey(game)) ?? null
    return {
      name: game.name,
      title: game.title,
      platform: game.platform,
      platformLabel: labels.labelFor(game.platform),
      version: game.version,
      mode: toMode(game.mode),
      kind: game.kind,
      description: game.description,
      author: game.author,
      category: game.category,
      imagePath: game.imageUrl,
      installed: record !== null,
      updateAvailable: record !== null && record.asset !== game.asset,
      installedVersion: record?.version ?? null,
      menuEntryPath: record?.menuEntry ?? null,
      executablePath: record?.executable ?? null,
      // The catalog's own play address wins where it gives one: a store that gates its
      // web builds serves them from a page that knows how to ask somebody to sign in,
      // and the raw /file/ directory under it does not.
      hostedUrl: game.mode === WEB_MODE
        ? game.access?.webUrl ?? engine.launchers.webUrl(game)
        : null,
      installable: true,
      unavailableReason: null,
      unavailableDetail: null,
      access: game.access
    }
  }

  private toPaths (engine: StoreEngineContext): StorePaths {
    const host = this.hosts.findHost()
    return {
      operatingSystem: engine.layout.operatingSystem,
      architecture: host.architecture,
      installRoot: engine.layout.installRoot,
      menuDirectory: engine.layout.menuDirectory,
      storeFolder: engine.layouts.ownedRoot(engine.layout),
      menuGroup: engine.layouts.menuGroup(engine.layout),
      catalogBaseUrl: engine.configuration.store.baseUrl,
      storeName: engine.configuration.store.name,
      storeId: engine.configuration.store.id
    }
  }
}

/** Everything one store's operations need, assembled from its home. */
interface StoreEngineContext {
  readonly configuration: StoreConfiguration
  readonly layout: DesktopLayout
  readonly layouts: DesktopLayoutResolver
  readonly catalog: CatalogClient
  readonly service: ServiceDescriptorClient
  readonly platforms: PlatformLabelsClient
  readonly launchers: LauncherWriter
  readonly surveyor: CatalogSurveyor
  readonly state: StoreStateRepository
  readonly installer: GameInstaller
  readonly log: (line: string) => void
}

/**
 * A title this machine cannot install, in the same shape as an installable one.
 *
 * The mode is `app` for want of a truer answer: a title with no build has no mode,
 * and nothing reads this one because `installable` is false.
 */
function toUnavailableGame (entry: UnavailableEntry, labels: PlatformLabels): Game {
  return {
    name: entry.name,
    title: entry.title,
    platform: entry.platform,
    platformLabel: labels.labelFor(entry.platform),
    version: entry.version,
    mode: APP_MODE,
    kind: '',
    description: entry.description,
    author: entry.author,
    category: entry.category,
    imagePath: entry.imageUrl,
    installed: false,
    updateAvailable: false,
    installedVersion: null,
    menuEntryPath: null,
    executablePath: null,
    hostedUrl: null,
    installable: false,
    unavailableReason: entry.reason,
    unavailableDetail: entry.detail,
    access: entry.access
  }
}

interface SignInContext {
  readonly client: DeviceSignInClient
  readonly descriptor: ServiceDescriptor
  readonly log: (line: string) => void
}

/**
 * Holding a token for a store that has no sign-in is not being signed in.
 *
 * It happens: a store can lose its identity configuration, or a client can keep a token
 * from before. Reporting it as signed in would offer a "sign out" for a door that is no
 * longer there.
 */
function toAccount (descriptor: ServiceDescriptor, token: string | null): StoreAccount {
  const available = descriptor.auth !== null
  return { signInAvailable: available, signedIn: available && token !== null }
}

/**
 * Removing a store needs the repository that found it; nothing else here does.
 *
 * The default refuses rather than pretending. A gateway assembled without one — the
 * smoke test — reads catalogs perfectly well, and should say so plainly if somebody
 * asks it to delete something, instead of silently doing nothing.
 */
const NO_STORES: InstalledStoreRepository = {
  findAll: (): readonly [] => [],
  findByHome: (): null => null,
  readRoots: (): readonly [] => [],
  resolveDefaultHome: (storeId: string): string => storeId,
  removeHome: (): never => { throw new Error('this gateway was built without a store repository') }
}

/**
 * A client with nowhere to keep a token is a client that is never signed in.
 *
 * The two writers throw nothing away and record nothing: this is the shape the smoke
 * test runs in, where there is no Electron and therefore no keychain, and a store with
 * no sign-in behaves exactly as it always did.
 */
const NO_CREDENTIALS: CredentialRepository = {
  readToken: (): null => null,
  writeToken: (storeId: string, token: string): void => { void storeId; void token },
  clearToken: (storeId: string): void => { void storeId }
}

function toMode (mode: string): GameMode {
  return mode === WEB_MODE ? WEB_MODE : APP_MODE
}
