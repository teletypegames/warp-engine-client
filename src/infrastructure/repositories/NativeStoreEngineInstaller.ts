import fs from 'node:fs'
import path from 'node:path'
import type { EngineProgressListener } from '../../domain/models/EngineProgress'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import type { RegistryStore } from '../../domain/models/RegistryStore'
import { DESKTOP_STORE_ENGINE } from '../../domain/models/StoreEngine'
import { deriveStoreId } from '../../domain/models/StoreIdentity'
import type { StoreEngineInstaller } from '../../domain/ports/StoreEngineInstaller'
import { asRecord, readString } from '../json/JsonRecord'
import { HttpStatusError, type HttpTextClient } from '../http/HttpTextClient'

const CONFIG_FILE_NAME = 'config.json'
const DEFAULT_FORGE_BASE = 'https://git.teletypegames.org'
const DEFAULT_BRANCH = 'master'

/** What an install used to leave in a store home, back when the engine was a script. */
const RETIRED_ENGINE_FILES: readonly string[] = ['desktop_store.py', 'warpstore.py']

/**
 * Setting up a store where there is none.
 *
 * Since the engine moved into this application there is nothing to download but the
 * store's own configuration, so an install is one HTTP call and one file. The store
 * home stays where it was and keeps its name, because the state and the catalog cache
 * beside that config are what make an existing library recognisable.
 */
export class NativeStoreEngineInstaller implements StoreEngineInstaller {
  private readonly forgeBase: string

  public constructor (private readonly httpClient: HttpTextClient, forgeBase?: string) {
    const configured = process.env['FORGE_BASE']
    this.forgeBase = forgeBase ?? (configured !== undefined && configured.length > 0
      ? configured
      : DEFAULT_FORGE_BASE)
  }

  public async installEngine (
    home: string,
    store: RegistryStore,
    progress: EngineProgressListener = {}
  ): Promise<InstalledStore> {
    fs.mkdirSync(home, { recursive: true })

    const config = await this.readStoreConfig(store, progress)
    const configPath = path.join(home, CONFIG_FILE_NAME)
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
    this.removeRetiredEngine(home, progress)

    progress.onLog?.(`${store.name} is set up in ${home}`)
    const configStore = asRecord(config['store'])
    return {
      id: configStore === null ? deriveStoreId(store) : readString(configStore, 'id', deriveStoreId(store)),
      name: store.name,
      home,
      configPath,
      engine: DESKTOP_STORE_ENGINE.id
    }
  }

  /**
   * Clear out the scripts an older client downloaded here.
   *
   * A store home provisioned by 1.5.0 or by the shell installer holds two Python
   * files that nothing reads any more. They are harmless, but a directory that still
   * looks like it holds the engine invites someone to run it against a state file
   * this application is also writing.
   */
  private removeRetiredEngine (home: string, progress: EngineProgressListener): void {
    for (const fileName of RETIRED_ENGINE_FILES) {
      const filePath = path.join(home, fileName)
      if (!fs.existsSync(filePath)) continue
      fs.rmSync(filePath, { force: true })
      progress.onLog?.(`removed the retired ${fileName}`)
    }
  }

  /**
   * The store's configuration.
   *
   * Three cases, and all of them install:
   *
   *   - **a repository with a config.json** — that file is the authority on how the
   *     store behaves: which platforms it offers, which statuses it shows, where
   *     things land;
   *   - **a repository without one** (404) — the engine's defaults, as below;
   *   - **no repository at all** — the same defaults, without the round trip.
   *
   * The engine's built-in defaults already cover the host-to-asset mapping, the
   * modes, the platforms and the behaviour, so what a store actually has to supply is
   * identity: a slug, a name and a catalog. That is exactly what a registry record
   * carries, which is why a store needs no repository of its own. The registry always
   * wins on those three, whatever a config file says.
   */
  private async readStoreConfig (
    store: RegistryStore,
    progress: EngineProgressListener
  ): Promise<Record<string, unknown>> {
    const storeId = deriveStoreId(store)
    const config = await this.readPublishedConfig(store, storeId, progress)

    const existing = asRecord(config['store']) ?? {}
    config['store'] = {
      ...existing,
      id: readString(existing, 'id', storeId),
      name: store.name,
      base_url: store.catalogUrl
    }
    return config
  }

  private async readPublishedConfig (
    store: RegistryStore,
    storeId: string,
    progress: EngineProgressListener
  ): Promise<Record<string, unknown>> {
    const repositoryUrl = store.storeRepositoryUrl
    if (repositoryUrl === null) {
      progress.onLog?.(`${store.name} has no store repository — using the engine defaults`)
      return this.defaultConfig(storeId)
    }
    try {
      progress.onLog?.(`reading the store config from ${repositoryUrl}`)
      const body = await this.httpClient.readText(this.configUrl(repositoryUrl))
      return { ...(asRecord(JSON.parse(body)) ?? {}) }
    } catch (error: unknown) {
      if (!(error instanceof HttpStatusError) || error.statusCode !== 404) throw error
      progress.onLog?.('no config.json in the store repository — using the engine defaults')
      return this.defaultConfig(storeId)
    }
  }

  /**
   * What a store gets when nothing else says otherwise.
   *
   * Two fields, on top of the identity added by the caller. The subfolder keeps two
   * stores on one machine out of each other's files, and it is the prune boundary, so
   * it must be the store's own. Demo titles are listed because a catalog that
   * publishes them means them to be played — the engine defaults to released and
   * archived only, which is the safer default for a store nobody configured.
   */
  private defaultConfig (storeId: string): Record<string, unknown> {
    return {
      paths: { subfolder: storeId },
      catalog: { statuses: ['released', 'archived', 'demo'] }
    }
  }

  private configUrl (repositoryUrl: string, branch: string = DEFAULT_BRANCH): string {
    return `${repositoryUrl.replace(/\/+$/, '')}/raw/branch/${branch}/${CONFIG_FILE_NAME}`
  }
}
