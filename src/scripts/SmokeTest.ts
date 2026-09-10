import fs from 'node:fs'
import path from 'node:path'
import { GameDtoMapper } from '../application/mappers/GameDtoMapper'
import { describeError } from '../domain/errors/DescribeError'
import type { CatalogListing } from '../domain/models/CatalogListing'
import type { InstalledStore } from '../domain/models/InstalledStore'
import { DESKTOP_STORE_ENGINE } from '../domain/models/StoreEngine'
import { deriveStoreId } from '../domain/models/StoreIdentity'
import type { CredentialRepository } from '../domain/ports/CredentialRepository'
import { BuildConfiguration } from '../infrastructure/config/BuildConfiguration'
import { checkForUpdate } from '../domain/models/ClientRelease'
import { NativeStoreCatalogGateway } from '../infrastructure/engine/NativeStoreCatalogGateway'
import { HttpTextClient } from '../infrastructure/http/HttpTextClient'
import { FileSystemInstalledStoreRepository } from '../infrastructure/repositories/FileSystemInstalledStoreRepository'
import { HttpClientReleaseGateway } from '../infrastructure/repositories/HttpClientReleaseGateway'
import { HttpStoreRegistryRepository } from '../infrastructure/repositories/HttpStoreRegistryRepository'
import type { GameDto } from '../shared/contracts/dto/GameDto'
import { ENGLISH_MESSAGES } from '../shared/i18n/EnglishMessages'
import { HUNGARIAN_MESSAGES } from '../shared/i18n/HungarianMessages'
import { LOCALES } from '../shared/i18n/MessageBundle'

/**
 * Drives the store with no window and no Electron at all.
 *
 * Since the engine is part of this application, this exercises the real thing rather
 * than a child process: a bad release choice or a broken menu entry fails here.
 *
 * This is the second composition root, and the reason the layers are worth having:
 * the same services the window uses are assembled here against the same ports, so an
 * integration mistake shows up in a terminal rather than in a screenshot.
 *
 *   npm run smoke                                       the store on this machine
 *   SMOKE_HOME=/path/to/store-home npm run smoke        a sandbox store
 *   SMOKE_TOKEN=<bearer> npm run smoke                  as a signed-in person
 *
 * `SMOKE_TOKEN` exists because the signed-in path is otherwise untestable here: the
 * real credential store is the OS keychain, reached through Electron, and there is no
 * Electron in this process. Without it a gated catalog can only ever be read as an
 * anonymous caller, and "owned" and "not owned" never happen.
 */
class SmokeTest {
  private failed = false

  private readonly stores = new FileSystemInstalledStoreRepository()
  private readonly catalogGateway = new NativeStoreCatalogGateway(envCredentials(), this.stores)
  private readonly httpClient = new HttpTextClient()
  private readonly buildConfiguration = new BuildConfiguration()
  private readonly registry = new HttpStoreRegistryRepository(this.httpClient, this.buildConfiguration)
  private readonly releases = new HttpClientReleaseGateway(this.httpClient, this.buildConfiguration)
  private readonly gameMapper = new GameDtoMapper()

  public async run (): Promise<number> {
    console.log('warp-engine-client smoke test')

    this.checkMessages()
    await this.checkRegistry()
    await this.checkReleases()

    const store = this.findStore()
    if (store === null) return this.failed ? 1 : 0
    await this.checkCatalog(store)

    return this.failed ? 1 : 0
  }

  /** The bundles are typed against one key set, so this only counts them. */
  private checkMessages (): void {
    const english = Object.keys(ENGLISH_MESSAGES).length
    const hungarian = Object.keys(HUNGARIAN_MESSAGES).length
    if (english === hungarian) this.reportOk('strings', `${String(english)} keys × ${String(LOCALES.length)} languages`)
    else this.reportBad('strings', `en has ${String(english)}, hu has ${String(hungarian)}`)
  }

  private async checkRegistry (): Promise<void> {
    try {
      const stores = await this.registry.listStores()
      if (stores.length === 0) {
        this.reportBad('registry', `${this.registry.sourceUrl} returned no stores`)
        return
      }
      this.reportOk('registry', `${String(stores.length)} store(s) from ${this.registry.sourceUrl}`)
      // The slug is worth printing: it names the store home and the games subfolder, and
      // it is derived here rather than told to us, so a wrong catalog URL shows up as a
      // wrong folder name before anything is installed.
      for (const store of stores) {
        this.reportOk(`  ${store.name}`, `${store.catalogUrl} · ${deriveStoreId(store)}`)
      }
    } catch (error: unknown) {
      this.reportBad('registry', `${this.registry.sourceUrl}: ${describeError(error)}`)
    }
  }

  /**
   * The release feed answers, and the comparison reads it the right way round.
   *
   * The version compared against is the one in the package.json this build was made
   * from, the same one the app reports about itself.
   */
  private async checkReleases (): Promise<void> {
    try {
      const latest = await this.releases.readLatestRelease()
      if (latest.version.length === 0 || latest.url.length === 0) {
        this.reportBad('releases', `${this.releases.sourceUrl} answered without a version or a page`)
        return
      }
      const current = readOwnVersion()
      const check = checkForUpdate(current, latest)
      this.reportOk('releases', `${latest.version} at ${latest.url} — this build is ${current}, ` +
        (check.updateAvailable ? 'an update is available' : 'nothing newer'))
      // The comparison itself, on values with a known answer.
      const older = checkForUpdate('2.8.0', { version: '2.9.0', url: '' }).updateAvailable
      const same = checkForUpdate('2.9.0', { version: 'v2.9', url: '' }).updateAvailable
      const newer = checkForUpdate('3.0.0', { version: '2.9.9', url: '' }).updateAvailable
      if (older && !same && !newer) this.reportOk('version compare', '2.8.0 < 2.9.0, 2.9.0 = v2.9, 3.0.0 > 2.9.9')
      else this.reportBad('version compare', `older:${String(older)} same:${String(same)} newer:${String(newer)}`)
    } catch (error: unknown) {
      this.reportBad('releases', `${this.releases.sourceUrl}: ${describeError(error)}`)
    }
  }

  private findStore (): InstalledStore | null {
    const sandbox = process.env['SMOKE_HOME']
    if (sandbox !== undefined && sandbox.length > 0) {
      const home = path.resolve(sandbox)
      const store: InstalledStore = {
        id: path.basename(home).replace(DESKTOP_STORE_ENGINE.homeSuffix, ''),
        name: path.basename(home),
        home,
        configPath: path.join(home, 'config.json'),
        catalogUrl: '',
        engine: DESKTOP_STORE_ENGINE.id
      }
      if (!fs.existsSync(store.configPath)) {
        this.reportBad('SMOKE_HOME', `${store.configPath} is missing`)
        return null
      }
      this.reportOk('store (SMOKE_HOME)', store.home)
      return store
    }

    const found = this.stores.findAll()[0]
    if (found === undefined) {
      console.log('  skip  no store installed — run the app once, or set SMOKE_HOME')
      console.log(`        it would be installed in ${this.stores.resolveDefaultHome('ttg')}`)
      return null
    }
    this.reportOk('store found', `${found.id} in ${found.home}`)
    return found
  }

  private async checkCatalog (store: InstalledStore): Promise<void> {
    const logLines: string[] = []
    const progress = { onLog: (line: string): void => { logLines.push(line) } }

    const paths = await this.catalogGateway.readPaths(store, progress)
    if (paths.operatingSystem.length > 0 && paths.storeFolder.length > 0) {
      this.reportOk('paths', `${paths.operatingSystem} → ${paths.storeFolder}`)
    } else {
      this.reportBad('paths', JSON.stringify(paths))
    }

    const listing: CatalogListing = await this.catalogGateway.listGames(store, progress)
    if (listing.games.length === 0) {
      this.reportBad('list', 'no games came back')
      return
    }
    const games = this.gameMapper.toDtoList(listing.games, listing.paths?.catalogBaseUrl ?? '')
    this.reportListing(games)
    this.reportAccess(listing, games)

    if (logLines.length > 0) this.reportOk('stderr log', `${String(logLines.length)} lines (kept off stdout)`)
  }

  /**
   * What the catalog said about who may have what.
   *
   * The load-bearing case is the boring one: an older engine says nothing, every title
   * comes back `open`, and the client behaves exactly as it did before any of this
   * existed. A gated catalog is where the rest of it starts mattering.
   */
  private reportAccess (listing: CatalogListing, games: readonly GameDto[]): void {
    const account = listing.account
    this.reportOk('sign-in', account.signInAvailable
      ? (account.signedIn ? 'offered, and signed in' : 'offered, not signed in')
      : 'not offered by this catalog')

    const counts = new Map<string, number>()
    for (const game of games) {
      counts.set(game.accessVerdict, (counts.get(game.accessVerdict) ?? 0) + 1)
    }
    const summary = [...counts.entries()]
      .map(([verdict, count]: readonly [string, number]): string => `${verdict}:${String(count)}`)
      .join(', ')
    this.reportOk('access', summary)

    // A price with nothing to click, or a purchase button with no price, is a card
    // somebody cannot act on.
    const unbuyable = games.filter((game: GameDto): boolean =>
      game.accessVerdict === 'purchasable' && game.purchaseUrl === null)
    if (unbuyable.length > 0) {
      this.reportBad('purchase links', `${String(unbuyable.length)} priced titles have nowhere to buy them`)
    } else if ((counts.get('purchasable') ?? 0) > 0) {
      this.reportOk('purchase links', 'every priced title has one')
    }
  }

  private reportListing (games: readonly GameDto[]): void {
    const installable = games.filter((game: GameDto): boolean => game.installable)
    const native = installable.filter((game: GameDto): boolean => game.mode === 'app').length
    const hosted = installable.length - native
    this.reportOk('list', `${String(games.length)} titles ` +
      `(app:${String(native)}, web:${String(hosted)}, unavailable:${String(games.length - installable.length)})`)

    // The listing is supposed to carry what it cannot install, with a reason on each.
    const unavailable = games.filter((game: GameDto): boolean => !game.installable)
    const unexplained = unavailable.filter((game: GameDto): boolean => game.unavailableReason === null)
    if (unexplained.length > 0) this.reportBad('unavailable', `${String(unexplained.length)} have no reason`)
    else if (unavailable.length > 0) {
      const first = unavailable[0]
      if (first !== undefined) {
        this.reportOk('unavailable', `${String(unavailable.length)}, e.g. ${first.name}: ${first.unavailableReason ?? ''}`)
      }
    }

    const withoutTitle = games.filter((game: GameDto): boolean =>
      game.name.length === 0 || game.title.length === 0 || game.platform.length === 0)
    if (withoutTitle.length > 0) this.reportBad('game shape', `${String(withoutTitle.length)} entries are incomplete`)
    else this.reportOk('game shape', 'name, title, platform, version, mode, installed, updateAvailable')

    const installed = games.filter((game: GameDto): boolean => game.installed)
    this.reportOk('installed', `${String(installed.length)} of ${String(games.length)}`)

    const unlaunchable = installed.filter((game: GameDto): boolean => !game.launchable)
    if (unlaunchable.length > 0) this.reportBad('launch targets', `${String(unlaunchable.length)} installed titles have nothing to launch`)
    else if (installed.length > 0) this.reportOk('launch targets', 'every installed title has one')

    const withArt = games.filter((game: GameDto): boolean => game.imageUrl !== null)
    if (withArt.length > 0) {
      const first = withArt[0]
      if (first !== undefined) this.reportOk('box art', first.imageUrl ?? '')
    }
  }

  private reportOk (label: string, value?: string): void {
    console.log(`  ok    ${label}${value === undefined ? '' : `: ${value}`}`)
  }

  private reportBad (label: string, value: string): void {
    this.failed = true
    console.log(`  FAIL  ${label}: ${value}`)
  }
}

void new SmokeTest().run().then(
  (code: number): void => { process.exitCode = code },
  (error: unknown): void => {
    console.log(`  FAIL  error: ${describeError(error)}`)
    process.exitCode = 1
  }
)

/** The version of the package this test was built from — what the app says about itself. */
function readOwnVersion (): string {
  for (const candidate of [
    path.join(__dirname, '..', '..', 'package.json'),
    path.join(__dirname, '..', 'package.json')
  ]) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(candidate, 'utf8'))
      if (typeof parsed === 'object' && parsed !== null && 'version' in parsed && typeof parsed.version === 'string') {
        return parsed.version
      }
    } catch {
      // The next candidate; the build directory is one level deeper than the source.
    }
  }
  return '0.0.0'
}

/**
 * The token from the environment, for every store.
 *
 * Deliberately not per store: this is a test harness pointed at one catalog at a time,
 * and a keyed map here would be ceremony around a single value. Nothing writes — a
 * smoke run must not leave a credential behind on the machine that ran it.
 */
function envCredentials (): CredentialRepository {
  const token = process.env['SMOKE_TOKEN'] ?? ''
  return {
    readToken: (): string | null => (token.length > 0 ? token : null),
    writeToken: (storeId: string, value: string): void => { void storeId; void value },
    clearToken: (storeId: string): void => { void storeId }
  }
}
