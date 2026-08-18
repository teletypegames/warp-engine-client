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
 * Finds stores where the shell installers put them.
 *
 * The roots are searched in the installers' own order, and `STORE_ROOT` comes
 * first so a sandbox can be driven without touching a working installation — which
 * is how this repository is tested.
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

  private readStoreAt (home: string, directoryName: string): InstalledStore | null {
    for (const engine of STORE_ENGINES) {
      const scriptPath = path.join(home, engine.scriptFileName)
      const configPath = path.join(home, CONFIG_FILE_NAME)
      if (!fs.existsSync(scriptPath) || !fs.existsSync(configPath)) continue
      const id = directoryName.replace(engine.homeSuffix, '')
      return {
        id,
        name: this.readStoreName(configPath, id),
        home,
        scriptPath,
        configPath,
        engine: engine.id
      }
    }
    return null
  }

  /**
   * The store's own name, from the config the installer wrote.
   *
   * Read here rather than asked of the engine: the switcher lists every store on
   * the machine, and starting a Python process per entry to learn its name would
   * be absurd.
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
