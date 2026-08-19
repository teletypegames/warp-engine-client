import fs from 'node:fs'
import path from 'node:path'
import type { EngineProgressListener } from '../../domain/models/EngineProgress'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import type { RegistryStore } from '../../domain/models/RegistryStore'
import { DESKTOP_STORE_ENGINE } from '../../domain/models/StoreEngine'
import { deriveStoreId } from '../../domain/models/StoreIdentity'
import type { StoreEngineInstaller } from '../../domain/ports/StoreEngineInstaller'

const CONFIG_FILE_NAME = 'config.json'

/** What an install used to leave in a store home, back when the engine was a script. */
const RETIRED_ENGINE_FILES: readonly string[] = ['desktop_store.py', 'warpstore.py']

/**
 * Setting up a store where there is none.
 *
 * Nothing is downloaded and nothing is asked of a server. The engine ships in this
 * application and its defaults already cover the host-to-asset mapping, the install
 * modes, the platforms and the behaviour; what a registry record adds is identity — a
 * name, a catalog and a slug — and that is what gets written.
 *
 * The config is written to disk rather than kept in memory because it is the store's
 * own record of itself: `StoreConfigurationReader` reads it on every operation, an
 * existing store home is recognised by it, and a person can look at it.
 */
export class NativeStoreEngineInstaller implements StoreEngineInstaller {
  public installEngine (
    home: string,
    store: RegistryStore,
    progress: EngineProgressListener = {}
  ): Promise<InstalledStore> {
    fs.mkdirSync(home, { recursive: true })

    const storeId = deriveStoreId(store)
    const configPath = path.join(home, CONFIG_FILE_NAME)
    fs.writeFileSync(configPath, `${JSON.stringify(this.buildConfig(store, storeId), null, 2)}\n`)
    this.removeRetiredEngine(home, progress)

    progress.onLog?.(`${store.name} is set up in ${home}`)
    return Promise.resolve({
      id: storeId,
      name: store.name,
      home,
      configPath,
      engine: DESKTOP_STORE_ENGINE.id
    })
  }

  /**
   * The store's configuration: its identity, and the two things worth stating.
   *
   * Everything absent from this falls to the engine's defaults, which is most of it. The
   * subfolder is named after the store so two stores on one machine cannot reach into
   * each other's files — it is the prune boundary, so it has to be the store's own.
   * Demo titles are listed because a catalog that publishes them means them to be
   * played; the engine defaults to released and archived only, which is the safer
   * default for a store nobody configured.
   */
  private buildConfig (store: RegistryStore, storeId: string): Record<string, unknown> {
    return {
      store: { id: storeId, name: store.name, base_url: store.catalogUrl },
      paths: { subfolder: storeId },
      catalog: { statuses: ['released', 'archived', 'demo'] }
    }
  }

  /**
   * Clear out the scripts an older client downloaded here.
   *
   * A store home provisioned by 1.5.0 or by a shell installer holds two Python files
   * that nothing reads any more. They are harmless, but a directory that still looks
   * like it holds the engine invites someone to run it against a state file this
   * application is also writing.
   */
  private removeRetiredEngine (home: string, progress: EngineProgressListener): void {
    for (const fileName of RETIRED_ENGINE_FILES) {
      const filePath = path.join(home, fileName)
      if (!fs.existsSync(filePath)) continue
      fs.rmSync(filePath, { force: true })
      progress.onLog?.(`removed the retired ${fileName}`)
    }
  }
}
