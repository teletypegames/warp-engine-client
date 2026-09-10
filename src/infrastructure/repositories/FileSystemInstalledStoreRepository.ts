import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { EngineProgressListener } from '../../domain/models/EngineProgress'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import { DESKTOP_STORE_ENGINE, STORE_ENGINES } from '../../domain/models/StoreEngine'
import type { InstalledStoreRepository } from '../../domain/ports/InstalledStoreRepository'
import { StoreFileSystem } from '../files/StoreFileSystem'
import { asRecord, readString } from '../json/JsonRecord'

const STORE_DIRECTORY_NAME = 'warp-engine-store'
const CONFIG_FILE_NAME = 'config.json'

/**
 * Finds stores where they were put.
 *
 * The roots are searched in the shell installers' own order — those homes are still
 * valid stores. `STORE_ROOT` replaces the lot: a sandbox has to be a sandbox, and it
 * only prepended before, so a "sandboxed" run still listed the real stores, could
 * switch to one, and — now that stores can be removed — could delete one. The README
 * always said "instead of the real one"; this is the behaviour catching up.
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
    const override = process.env['STORE_ROOT']
    if (override !== undefined && override.length > 0) return [override]

    const home = os.homedir()
    const roots: string[] = []
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

  /**
   * Remove a store home, and only one this repository actually found.
   *
   * The check is the point. This is the one call in the application that deletes a
   * directory tree the *window* named, and the window is the least trusted thing here;
   * resolving the path against what a scan returns means a caller can ask for the
   * removal of a store, never of a path.
   */
  public removeHome (home: string): void {
    const known = this.findByHome(home)
    if (known === null) {
      throw new Error(`not a store home on this machine: ${home}`)
    }
    fs.rmSync(known.home, { recursive: true, force: true })
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
  /**
   * Rename a store, and only one this repository actually found.
   *
   * The name is the one field of a store that is a choice rather than derived — the id,
   * the home and the game folder all come from the catalog — so it is the one field
   * that can change without the store becoming a different one. The rest of the config
   * is written back as it was read: this is the store's own record of itself, and a
   * rename has no business tidying it.
   */
  public renameStore (home: string, name: string, progress: EngineProgressListener = {}): InstalledStore {
    const known = this.findByHome(home)
    if (known === null) throw new Error(`not a store home on this machine: ${home}`)
    const trimmed = name.trim()
    if (trimmed.length === 0) throw new Error('a store needs a name')

    const log = (line: string): void => { progress.onLog?.(line) }
    const files = new StoreFileSystem(`${known.id}-store`, log)
    const config = asRecord(files.readJson(known.configPath)) ?? {}
    const store = asRecord(config['store']) ?? {}
    files.writeAtomic(
      known.configPath,
      Buffer.from(`${JSON.stringify({ ...config, store: { ...store, name: trimmed } }, null, 2)}\n`, 'utf8'),
      readFileMode(known.configPath)
    )
    log(`${known.name} is now called ${trimmed}`)
    return { ...known, name: trimmed }
  }

  private readStoreAt (home: string, directoryName: string): InstalledStore | null {
    const configPath = path.join(home, CONFIG_FILE_NAME)
    if (!fs.existsSync(configPath)) return null
    for (const engine of STORE_ENGINES) {
      if (!directoryName.endsWith(engine.homeSuffix)) continue
      const id = directoryName.slice(0, directoryName.length - engine.homeSuffix.length)
      const descriptor = this.readStoreDescriptor(configPath)
      return {
        id,
        name: descriptor.name.length > 0 ? descriptor.name : id,
        home,
        configPath,
        catalogUrl: descriptor.catalogUrl,
        engine: engine.id
      }
    }
    return null
  }

  /**
   * The store's own name and catalog, from the config the installer wrote.
   *
   * Read here rather than asked of the engine: the switcher lists every store on the
   * machine, and assembling an engine per entry to learn its name would be absurd.
   * `StoreConfigurationReader` knows the same two keys; it reads the whole file for an
   * engine, this reads two fields for a list.
   */
  private readStoreDescriptor (configPath: string): { readonly name: string; readonly catalogUrl: string } {
    try {
      const config = asRecord(JSON.parse(fs.readFileSync(configPath, 'utf8')))
      const store = config === null ? null : asRecord(config['store'])
      if (store === null) return { name: '', catalogUrl: '' }
      return {
        name: readString(store, 'name'),
        catalogUrl: readString(store, 'base_url').replace(/\/+$/, '')
      }
    } catch {
      return { name: '', catalogUrl: '' }
    }
  }
}

/** The mode a file already has, so a rewrite keeps it; the installer's default when it cannot be read. */
function readFileMode (filePath: string): number {
  try {
    return fs.statSync(filePath).mode & 0o777
  } catch {
    return 0o644
  }
}
