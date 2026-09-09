import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { StoreProvisioningService } from '../application/services/StoreProvisioningService'
import { StoreSelectionService } from '../application/services/StoreSelectionService'
import { PreferencesService } from '../application/services/PreferencesService'
import type { InstalledStore } from '../domain/models/InstalledStore'
import type { ApplicationEnvironment } from '../domain/ports/ApplicationEnvironment'
import type { StoreRegistryRepository } from '../domain/ports/StoreRegistryRepository'
import { NativeStoreCatalogGateway } from '../infrastructure/engine/NativeStoreCatalogGateway'
import { FileSystemInstalledStoreRepository } from '../infrastructure/repositories/FileSystemInstalledStoreRepository'
import { NativeStoreEngineInstaller } from '../infrastructure/repositories/NativeStoreEngineInstaller'
import { JsonFilePreferencesRepository } from '../infrastructure/repositories/JsonFilePreferencesRepository'
import { NullCredentialRepository } from '../infrastructure/repositories/NullCredentialRepository'
import { TranslationCatalog } from '../shared/i18n/TranslationCatalog'
import { describeError } from '../domain/errors/DescribeError'
import { asRecord } from '../infrastructure/json/JsonRecord'

/**
 * Adding a store and taking it away again, in a sandbox.
 *
 * This exists because removal is the only code in the application that deletes a
 * directory tree, and the path it deletes is named by the window — the least trusted
 * thing here. A mistake in it is not a rendering glitch; it is somebody's files. The
 * smoke test cannot cover it, since it runs against the real machine and would have to
 * delete a real store to prove anything.
 *
 * Everything happens under a temporary root: `STORE_ROOT` is what the repository looks
 * at first, so nothing outside it is even visible to this run.
 *
 *   npm run storetest
 */
class StoreLifecycleTest {
  private failed = false

  private readonly root = fs.mkdtempSync(path.join(os.tmpdir(), 'warp-store-lifecycle-'))
  private readonly stores: FileSystemInstalledStoreRepository
  private readonly provisioning: StoreProvisioningService
  private readonly selection: StoreSelectionService

  public constructor () {
    // Before the repository is built: the roots are read from the environment, and
    // this is what keeps the run inside the sandbox.
    process.env['STORE_ROOT'] = this.root

    this.stores = new FileSystemInstalledStoreRepository()
    const preferences = new PreferencesService(
      new JsonFilePreferencesRepository(sandboxEnvironment(this.root)), sandboxEnvironment(this.root),
      new TranslationCatalog()
    )
    this.selection = new StoreSelectionService(this.stores, preferences)
    this.provisioning = new StoreProvisioningService(
      emptyRegistry(),
      new NativeStoreEngineInstaller(),
      this.stores,
      this.selection,
      new NativeStoreCatalogGateway(new NullCredentialRepository(), this.stores)
    )
  }

  public async run (): Promise<number> {
    console.log('warp-engine-client store lifecycle test')
    console.log(`  ..    sandbox: ${this.root}`)

    try {
      const store = await this.checkAddByUrl()
      await this.checkRemove(store)
      await this.checkRemoveRefusesAnythingElse()
      await this.checkNormalisation()
    } catch (error: unknown) {
      this.report(false, 'run', describeError(error))
    } finally {
      fs.rmSync(this.root, { recursive: true, force: true })
    }
    return this.failed ? 1 : 0
  }

  /** A typed address becomes a store, with its identity derived from the URL. */
  private async checkAddByUrl (): Promise<InstalledStore> {
    const store = await this.provisioning.installCatalog('orbit.teletypegames.org')

    // https assumed, name from the host, id from the host's first label — none of it
    // supplied, all of it derived, which is what makes a bare address enough to type.
    this.report(store.id === 'orbit', 'id from the host', store.id)
    this.report(store.name === 'orbit.teletypegames.org', 'name from the host', store.name)
    this.report(fs.existsSync(store.configPath), 'config written', store.configPath)
    this.report(
      readBaseUrl(store.configPath) === 'https://orbit.teletypegames.org',
      'https assumed', readBaseUrl(store.configPath)
    )
    this.report(store.home.startsWith(this.root), 'inside the sandbox', store.home)
    this.report(this.stores.findAll().length === 1, 'found by a scan', String(this.stores.findAll().length))
    return store
  }

  /** And it goes away again, home and all. */
  private async checkRemove (store: InstalledStore): Promise<void> {
    await this.provisioning.removeStore(store)

    this.report(!fs.existsSync(store.home), 'home removed', store.home)
    this.report(this.stores.findAll().length === 0, 'gone from the scan')
    this.report(this.selection.findCurrentStore() === null, 'nothing open afterwards')
  }

  /**
   * The guard: a path that is not a store home on this machine is refused.
   *
   * This is the one that matters. The window names what to remove, so the only thing
   * standing between a typo — or something worse — and `rm -rf` is that the path has to
   * resolve to a store a scan actually found.
   */
  private async checkRemoveRefusesAnythingElse (): Promise<void> {
    const bystander = path.join(this.root, 'not-a-store')
    fs.mkdirSync(bystander, { recursive: true })
    fs.writeFileSync(path.join(bystander, 'keep-me.txt'), 'important')

    const fake: InstalledStore = {
      id: 'fake', name: 'fake', home: bystander,
      configPath: path.join(bystander, 'config.json'), engine: 'desktop'
    }
    let refused = false
    try {
      await this.provisioning.removeStore(fake)
    } catch {
      refused = true
    }

    this.report(refused, 'refuses a path that is not a store')
    this.report(fs.existsSync(path.join(bystander, 'keep-me.txt')), 'left the bystander alone')
  }

  /**
   * What is simply not an address is refused before anything is written.
   *
   * Refusing early is the point: a store home created for an unusable URL is a
   * directory somebody has to find and delete by hand, and they would have no idea
   * why it was there.
   */
  private async checkNormalisation (): Promise<void> {
    const accepted: string[] = []
    for (const value of [ '', '   ', 'http://', 'not a url at all' ]) {
      try {
        const store = await this.provisioning.installCatalog(value)
        accepted.push(`${JSON.stringify(value)} -> ${store.home}`)
      } catch {
        // Refused, which is what should happen.
      }
    }

    this.report(accepted.length === 0, 'refuses what is not an address', accepted.join(', '))
    this.report(this.stores.findAll().length === 0, 'and wrote nothing while refusing')
  }

  private report (passed: boolean, what: string, detail: string = ''): void {
    if (!passed) this.failed = true
    console.log(`  ${passed ? 'ok  ' : 'FAIL'}  ${what}${detail === '' ? '' : `: ${detail}`}`)
  }
}

/** A registry with nothing in it: this test is about the typed path, not the listed one. */
function emptyRegistry (): StoreRegistryRepository {
  return {
    sourceUrl: 'about:blank',
    listStores: (): Promise<readonly []> => Promise.resolve([])
  }
}

function sandboxEnvironment (root: string): ApplicationEnvironment {
  return {
    readVersion: (): string => '0.0.0-test',
    readSystemLocale: (): string => 'en',
    resolveUserDataPath: (fileName: string): string => path.join(root, fileName)
  }
}

/**
 * The base URL out of the config the installer wrote.
 *
 * Read through an index signature rather than a typed shape: the file is snake_case —
 * that is the format the store repositories publish and the shell engine wrote — and
 * naming the key in a type here would be the one place in this codebase declaring a
 * property the linter would then have to be told to allow.
 */
function readBaseUrl (configPath: string): string {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    const store = asRecord(asRecord(parsed)?.['store'])
    const baseUrl = store?.['base_url']
    return typeof baseUrl === 'string' ? baseUrl : ''
  } catch {
    return ''
  }
}

void new StoreLifecycleTest().run().then((code: number): void => { process.exitCode = code })
