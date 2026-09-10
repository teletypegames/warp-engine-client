import path from 'node:path'
import type { CatalogListing } from '../../domain/models/CatalogListing'
import type { CatalogPageProgress } from '../../domain/models/CatalogPage'
import type { WarpEngineVersion } from '../../domain/models/WarpEngineVersion'
import type { DesktopLayout } from '../../domain/models/DesktopLayout'
import type { EngineProgressListener } from '../../domain/models/EngineProgress'
import type { Game } from '../../domain/models/Game'
import { limitToNames, matchStateKeys } from '../../domain/models/InstalledRecord'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import type {
  CatalogSurvey, SelectedGame, UnavailableEntry
} from '../../domain/models/SelectedGame'
import type { ServiceDescriptor } from '../../domain/models/ServiceDescriptor'
import type { SignInPrompt, StoreAccount } from '../../domain/models/StoreAccount'
import type { StoreConfiguration } from '../../domain/models/StoreConfiguration'
import type { StorePaths } from '../../domain/models/StorePaths'
import type { CredentialRepository } from '../../domain/ports/CredentialRepository'
import type { InstalledStoreRepository } from '../../domain/ports/InstalledStoreRepository'
import type { SignInPollResult, StoreCatalogGateway } from '../../domain/ports/StoreCatalogGateway'
import { StoreFileSystem } from '../files/StoreFileSystem'
import { CatalogClient, type CatalogPageListener, type FetchedCatalog } from './CatalogClient'
import { CatalogSurveyor } from './CatalogSurveyor'
import type { CatalogEntry } from './dialects/CatalogDialect'
import { selectCatalogDialect } from './dialects/CatalogDialectSelector'
import { DesktopLayoutResolver } from './DesktopLayoutResolver'
import { DeviceSignInClient } from './DeviceSignInClient'
import { EngineGameMapper } from './EngineGameMapper'
import { GameInstaller } from './GameInstaller'
import { HostMachineDetector } from './HostMachineDetector'
import { LauncherWriter } from './launchers/LauncherWriter'
import { PayloadInstaller } from './PayloadInstaller'
import { PlatformLabelsClient } from './PlatformLabelsClient'
import { VocabularyClient } from './VocabularyClient'
import { ServiceDescriptorClient } from './ServiceDescriptorClient'
import { StoreConfigurationReader } from './StoreConfigurationReader'
import { StoreStateRepository } from './StoreStateRepository'

const STATE_FILE_NAME = 'state.json'
const CATALOG_CACHE_FILE_NAME = 'catalog.json'
const PLATFORM_LABELS_CACHE_FILE_NAME = 'platforms.json'
const VOCABULARY_CACHE_FILE_NAME = 'vocabulary.json'

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
  private readonly games = new EngineGameMapper()

  /**
   * Both are injected because they are the host's to choose: the credentials are the
   * OS keychain on a desktop and a null object in a headless run, and the store
   * repository is what removing a store needs to take the home away. Nothing here knows
   * which, and there is no default — a gateway that quietly wired itself would be a
   * third composition root hidden in an adapter.
   */
  public constructor (
    private readonly credentials: CredentialRepository,
    private readonly stores: InstalledStoreRepository
  ) {}

  public async listGames (
    store: InstalledStore,
    progress: EngineProgressListener = {}
  ): Promise<CatalogListing> {
    const engine = this.openStore(store, progress)
    const host = this.hosts.findHost()
    engine.log(`host: ${host.operatingSystem}/${host.architecture}`)

    const [ descriptor, labels, vocabulary ] = await Promise.all([
      engine.service.fetchDescriptor(), engine.platforms.fetchLabels(), engine.vocabulary.fetchVocabulary()
    ])
    const installed = engine.state.readState()
    const account = this.games.toAccount(descriptor, this.credentials.readToken(store.id))

    // The same assembly for every page and for the whole: a page's listing is simply
    // the listing of what has arrived, so nothing the window draws early is drawn twice
    // by different rules.
    const assemble = (entries: readonly CatalogEntry[]): CatalogListing => {
      const survey = engine.surveyor.survey(entries, host)
      // One list, both kinds: a client that hides what it cannot install leaves the
      // visitor wondering whether the catalog is small or their machine is unusual.
      const games = [
        ...survey.games.map((game: SelectedGame): Game => this.games.toGame(
          game, installed, labels, vocabulary,
          (selected: SelectedGame): string => engine.launchers.resolveWebUrl(selected))),
        ...survey.unavailable.map((entry: UnavailableEntry): Game =>
          this.games.toUnavailableGame(entry, labels, vocabulary))
      ].sort((left: Game, right: Game): number =>
        left.title.toLowerCase().localeCompare(right.title.toLowerCase()))
      return { games, skipped: survey.skipped, paths: this.toPaths(engine), account }
    }

    const entries = await this.readEntries(engine, (
      page: CatalogPageProgress, catalogSoFar: unknown, engineVersion: WarpEngineVersion
    ): void => {
      progress.onCatalogPage?.(page, assemble(selectCatalogDialect(engineVersion.resolved).listEntries(catalogSoFar)))
    })
    return assemble(entries)
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
    engine.log(`done — the games are in ${engine.layouts.resolveMenuGroup(engine.layout)}`)
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
   * Remove one title and install it again from the catalog.
   *
   * A sync keeps an install it finds intact, so a copy that is broken in a way the
   * record cannot see — a payload edited by hand, a launcher that no longer starts — is
   * left alone by Refresh. Here the record is removed first, so the installer sees no
   * previous install and unpacks, writes the icon and the menu entry from scratch.
   */
  public async reinstallGame (
    store: InstalledStore,
    name: string,
    progress: EngineProgressListener = {}
  ): Promise<void> {
    const engine = this.openStore(store, progress)
    const survey: CatalogSurvey = engine.surveyor.survey(
      await this.readEntries(engine), this.hosts.findHost())
    const wanted = limitToNames(survey.games, [name])
    if (wanted.length === 0) {
      engine.log(`not in the catalog, or not for this machine: ${name}`)
      return
    }

    const installed = engine.state.readState()
    for (const key of matchStateKeys(installed, [name])) {
      const record = installed.get(key)
      if (record === undefined) continue
      engine.log(`reinstalling ${record.name} ${record.version}: removing the copy here first`)
      engine.installer.removeGame(engine.layout, record)
      progress.onEvent?.({ event: 'removed', name: record.name })
      installed.delete(key)
    }
    engine.state.writeState(installed)

    await engine.installer.installAll(engine.layout, wanted, installed, false, progress)
    engine.state.writeState(installed)
    engine.launchers.refreshMenu(engine.layout)
    engine.log(`done — the games are in ${engine.layouts.resolveMenuGroup(engine.layout)}`)
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
    return this.games.toAccount(descriptor, this.credentials.readToken(store.id))
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
      account: this.games.toAccount(descriptor, this.credentials.readToken(store.id))
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
      await new DeviceSignInClient(engine.catalog.http, descriptor.auth.device).revoke()
    }
    this.credentials.clearToken(store.id)
    engine.log('signed out')
    return this.games.toAccount(descriptor, null)
  }

  /** The sign-in client for one store, or a clear error if the store offers none. */
  private async openSignIn (store: InstalledStore): Promise<SignInContext> {
    const engine = this.openStore(store, {})
    const descriptor = await engine.service.fetchDescriptor()
    if (descriptor.auth === null) {
      throw new Error(`${store.name} does not offer signing in`)
    }
    return {
      client: new DeviceSignInClient(engine.catalog.http, descriptor.auth.device),
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
  private async readEntries (
    engine: StoreEngineContext,
    onPage?: CatalogPageListener
  ): Promise<readonly CatalogEntry[]> {
    const fetched: FetchedCatalog = await engine.catalog.fetchCatalog(onPage)
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
      service: new ServiceDescriptorClient(catalog.http, configuration.store.baseUrl, log),
      platforms: new PlatformLabelsClient(
        catalog.http, configuration.store.baseUrl, files,
        path.join(store.home, PLATFORM_LABELS_CACHE_FILE_NAME), log),
      vocabulary: new VocabularyClient(
        catalog.http, configuration.store.baseUrl, files,
        path.join(store.home, VOCABULARY_CACHE_FILE_NAME), log),
      surveyor: new CatalogSurveyor(configuration, log),
      state: new StoreStateRepository(files, path.join(store.home, STATE_FILE_NAME), log),
      installer: new GameInstaller(
        configuration, layouts,
        new PayloadInstaller(catalog, files, log),
        launchers, catalog, files, log)
    }
  }

  private toPaths (engine: StoreEngineContext): StorePaths {
    const host = this.hosts.findHost()
    return {
      operatingSystem: engine.layout.operatingSystem,
      architecture: host.architecture,
      installRoot: engine.layout.installRoot,
      menuDirectory: engine.layout.menuDirectory,
      storeFolder: engine.layouts.resolveOwnedRoot(engine.layout),
      menuGroup: engine.layouts.resolveMenuGroup(engine.layout),
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
  readonly vocabulary: VocabularyClient
  readonly launchers: LauncherWriter
  readonly surveyor: CatalogSurveyor
  readonly state: StoreStateRepository
  readonly installer: GameInstaller
  readonly log: (line: string) => void
}


interface SignInContext {
  readonly client: DeviceSignInClient
  readonly descriptor: ServiceDescriptor
  readonly log: (line: string) => void
}



