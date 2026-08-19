import fs from 'node:fs'
import path from 'node:path'
import { GameDtoMapper } from '../application/mappers/GameDtoMapper'
import type { CatalogListing } from '../domain/models/CatalogListing'
import type { InstalledStore } from '../domain/models/InstalledStore'
import { DESKTOP_STORE_ENGINE } from '../domain/models/StoreEngine'
import { deriveStoreId } from '../domain/models/StoreIdentity'
import { NativeStoreCatalogGateway } from '../infrastructure/engine/NativeStoreCatalogGateway'
import { HttpTextClient } from '../infrastructure/http/HttpTextClient'
import { FileSystemInstalledStoreRepository } from '../infrastructure/repositories/FileSystemInstalledStoreRepository'
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
 */
class SmokeTest {
  private failed = false

  private readonly stores = new FileSystemInstalledStoreRepository()
  private readonly catalogGateway = new NativeStoreCatalogGateway()
  private readonly httpClient = new HttpTextClient()
  private readonly registry = new HttpStoreRegistryRepository(this.httpClient)
  private readonly gameMapper = new GameDtoMapper()

  public async run (): Promise<number> {
    console.log('warp-engine-client smoke test')

    this.checkMessages()
    await this.checkRegistry()

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
      this.reportBad('registry', `${this.registry.sourceUrl}: ${this.describe(error)}`)
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

    if (logLines.length > 0) this.reportOk('stderr log', `${String(logLines.length)} lines (kept off stdout)`)
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

  private describe (error: unknown): string {
    return error instanceof Error ? error.message : String(error)
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
    console.log(`  FAIL  error: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
)
