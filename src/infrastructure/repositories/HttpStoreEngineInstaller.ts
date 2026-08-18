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
   * Its repository is the authority on how the store behaves — which platforms,
   * which statuses, where things land. A repository without a config.json still
   * works: the engine merges whatever it is given onto its own defaults, so a
   * three-field config is a complete one. The registry wins on identity and on
   * which catalog to read.
   */
  private async readStoreConfig (
    store: RegistryStore,
    progress: EngineProgressListener
  ): Promise<Record<string, unknown>> {
    const storeId = deriveStoreId(store)
    let config: Record<string, unknown>
    try {
      progress.onLog?.(`reading the store config from ${store.storeRepositoryUrl}`)
      const body = await this.httpClient.readText(this.configUrl(store.storeRepositoryUrl))
      config = { ...(asRecord(JSON.parse(body)) ?? {}) }
    } catch (error: unknown) {
      if (!(error instanceof HttpStatusError) || error.statusCode !== 404) throw error
      progress.onLog?.('no config.json in the store repository — using the engine defaults')
      config = {
        paths: { subfolder: storeId },
        catalog: { statuses: ['released', 'archived', 'demo'] }
      }
    }

    const existing = asRecord(config['store']) ?? {}
    config['store'] = {
      ...existing,
      id: readString(existing, 'id', storeId),
      name: store.name,
      base_url: store.catalogUrl
    }
    return config
  }

  private configUrl (repositoryUrl: string, branch: string = DEFAULT_BRANCH): string {
    return `${repositoryUrl.replace(/\/+$/, '')}/raw/branch/${branch}/${CONFIG_FILE_NAME}`
  }
}
