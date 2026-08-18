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
const SCRIPT_MODE = 0o755
const PYTHON_SHEBANG = '#!/usr/bin/env python3'
const DEFAULT_FORGE_BASE = 'https://git.teletypegames.org'
const DEFAULT_BRANCH = 'master'

/**
 * Downloads the engine, the shared core and a store config into a store home.
 *
 * The same three files, in the same folder, the shell installer would place — so
 * the CLI and this client stay one installation, and running install.sh afterwards
 * only adds the launcher script. No launcher is written here: the window is it.
 */
export class HttpStoreEngineInstaller implements StoreEngineInstaller {
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

    for (const [fileName, url] of Object.entries(this.engineSources())) {
      progress.onLog?.(`downloading ${fileName}`)
      const body = await this.httpClient.readText(url)
      if (!body.startsWith(PYTHON_SHEBANG)) {
        throw new Error(`${fileName} does not look like the store engine — refusing to install it`)
      }
      fs.writeFileSync(path.join(home, fileName), body, { mode: SCRIPT_MODE })
    }

    const config = await this.readStoreConfig(store, progress)
    const configPath = path.join(home, CONFIG_FILE_NAME)
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)

    progress.onLog?.(`${store.name} is set up in ${home}`)
    const configStore = asRecord(config['store'])
    return {
      id: configStore === null ? deriveStoreId(store) : readString(configStore, 'id', deriveStoreId(store)),
      name: store.name,
      home,
      scriptPath: path.join(home, DESKTOP_STORE_ENGINE.scriptFileName),
      configPath,
      engine: DESKTOP_STORE_ENGINE.id
    }
  }

  /** Where the engine itself comes from: this client's own machinery, not the registry's. */
  private engineSources (): Readonly<Record<string, string>> {
    return {
      [DESKTOP_STORE_ENGINE.scriptFileName]:
        `${this.forgeBase}/stores/warp-engine-desktop-store/raw/branch/${DEFAULT_BRANCH}/${DESKTOP_STORE_ENGINE.scriptFileName}`,
      'warpstore.py': `${this.forgeBase}/engines/warpstore/raw/branch/${DEFAULT_BRANCH}/warpstore.py`
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
   * modes, the platforms and the behaviour, so what a store actually has to supply
   * is identity: a slug, a name and a catalog. That is exactly what a registry
   * record carries, which is why a store needs no repository of its own. The
   * registry always wins on those three, whatever a config file says.
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
   * stores on one machine out of each other's files, and it is the prune boundary,
   * so it must be the store's own. Demo titles are listed because a catalog that
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
