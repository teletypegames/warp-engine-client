import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import { DESKTOP_STORE_ENGINE, STORE_ENGINES } from '../../domain/models/StoreEngine'
import type { InstalledStoreRepository } from '../../domain/ports/InstalledStoreRepository'
import { asRecord, readString } from '../json/JsonRecord'

const STORE_DIRECTORY_NAME = 'warp-engine-store'
const CONFIG_FILE_NAME = 'config.json'

/**
 * Finds stores where they were put.
 *
 * The roots are searched in the shell installers' own order — those homes are still
 * valid stores — and `STORE_ROOT` comes first so a sandbox can be driven without
 * touching a working installation, which is how this repository is tested.
 */
export class FileSystemInstalledStoreRepository implements InstalledStoreRepository {
  public findAll (): readonly InstalledStore[] {
    const found: InstalledStore[] = []
    for (const root of this.readRoots()) {
      for (const entry of this.readDirectories(root)) {
        const home = path.join(root, entry)
        const store = this.readStoreAt(home, entry)
        if (store !== null) found.push(store)
      }
    }
    return found
  }

  public findByHome (home: string): InstalledStore | null {
    return this.findAll().find((store: InstalledStore): boolean => store.home === home) ?? null
  }

  public readRoots (): readonly string[] {
    const home = os.homedir()
    const roots: string[] = []
    const override = process.env['STORE_ROOT']
    if (override !== undefined && override.length > 0) roots.push(override)
    const xdgDataHome = process.env['XDG_DATA_HOME']
    if (xdgDataHome !== undefined && xdgDataHome.length > 0) {
      roots.push(path.join(xdgDataHome, STORE_DIRECTORY_NAME))
    }
    roots.push(path.join(home, '.local', 'share', STORE_DIRECTORY_NAME))
    if (process.platform === 'darwin') {
      roots.push(path.join(home, 'Library', 'Application Support', STORE_DIRECTORY_NAME))
    }
    const localAppData = process.env['LOCALAPPDATA']
    if (process.platform === 'win32' && localAppData !== undefined && localAppData.length > 0) {
      roots.push(path.join(localAppData, STORE_DIRECTORY_NAME))
    }
    return [...new Set(roots)]
  }

  public resolveDefaultHome (storeId: string): string {
    const root = this.readRoots()[0] ?? path.join(os.homedir(), '.local', 'share', STORE_DIRECTORY_NAME)
    return path.join(root, `${storeId}${DESKTOP_STORE_ENGINE.homeSuffix}`)
  }

  private readDirectories (root: string): readonly string[] {
    try {
      return fs.readdirSync(root, { withFileTypes: true })
        .filter((entry: fs.Dirent): boolean => entry.isDirectory())
        .map((entry: fs.Dirent): string => entry.name)
    } catch {
      // A root that does not exist is the normal case on a fresh machine.
      return []
    }
  }

  /**
   * A store home, recognised by its config and its directory name.
   *
   * The config is the only file that has to be there. It used to be the config *and*
   * the engine script, and dropping that condition is what lets a home provisioned by
   * an older client keep working after its scripts are cleared out.
   */
  private readStoreAt (home: string, directoryName: string): InstalledStore | null {
    const configPath = path.join(home, CONFIG_FILE_NAME)
    if (!fs.existsSync(configPath)) return null
    for (const engine of STORE_ENGINES) {
      if (!directoryName.endsWith(engine.homeSuffix)) continue
      const id = directoryName.slice(0, directoryName.length - engine.homeSuffix.length)
      return { id, name: this.readStoreName(configPath, id), home, configPath, engine: engine.id }
    }
    return null
  }

  /**
   * The store's own name, from the config the installer wrote.
   *
   * Read here rather than asked of the engine: the switcher lists every store on the
   * machine, and assembling an engine per entry to learn its name would be absurd.
   */
  private readStoreName (configPath: string, fallback: string): string {
    try {
      const config = asRecord(JSON.parse(fs.readFileSync(configPath, 'utf8')))
      const store = config === null ? null : asRecord(config['store'])
      const name = store === null ? '' : readString(store, 'name')
      return name.length > 0 ? name : fallback
    } catch {
      return fallback
    }
  }
}
