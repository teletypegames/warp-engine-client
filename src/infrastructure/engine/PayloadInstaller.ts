import fs from 'node:fs'
import path from 'node:path'
import type { SelectedGame } from '../../domain/models/SelectedGame'
import { ZipArchive } from '../archive/ZipArchive'
import type { StoreFileSystem } from '../files/StoreFileSystem'
import type { CatalogClient } from './CatalogClient'

/** Files that are never the program: data, libraries and documentation. */
const NEVER_A_PROGRAM: readonly string[] =
  ['.txt', '.md', '.json', '.so', '.dll', '.dylib', '.pck', '.dat']

/** What Windows starts by double-click: a binary, or a batch file wrapping one. */
const WINDOWS_PROGRAM_EXTENSIONS: readonly string[] = ['.exe', '.bat', '.cmd']

export type ExecutableKind = 'bundle' | 'exe'

export interface FoundProgram {
  readonly kind: ExecutableKind
  readonly executablePath: string
}

/**
 * Getting a native build onto the disk and finding what to launch in it.
 *
 * The archive is downloaded to a part file beside the payload and unpacked only once
 * it is complete, and the payload directory is replaced rather than merged: a build
 * that dropped a file between releases would otherwise keep the old one around and
 * the game would load it.
 */
export class PayloadInstaller {
  public constructor (
    private readonly catalog: CatalogClient,
    private readonly files: StoreFileSystem,
    private readonly log: (line: string) => void
  ) {}

  /** Download and unpack into `destination`. Returns bytes downloaded. */
  public async unpack (game: SelectedGame, destination: string): Promise<number> {
    const parent = path.dirname(destination)
    fs.mkdirSync(parent, { recursive: true })
    const archivePath = this.files.resolveTemporaryPath(parent, game.name, '.zip')

    try {
      const size = await this.catalog.downloadAsset(game.asset, archivePath)
      fs.rmSync(destination, { recursive: true, force: true })
      fs.mkdirSync(destination, { recursive: true })
      ZipArchive.open(archivePath).extractAll(destination)
      return size
    } finally {
      fs.rmSync(archivePath, { force: true })
    }
  }

  /**
   * The thing to launch inside an unpacked payload.
   *
   * A program named after the game wins outright: an archive that ships an emulator
   * next to a launcher script — the C64 and Plus/4 bundles carry yapeSDL and a
   * `<name>` / `<name>.bat` / `<name>.command` that sets the machine and autostarts
   * the cartridge — names the launcher after the game precisely so that this is the
   * thing to run, and neither the emulator binary nor its `.app` is. Then a `bundle`,
   * a macOS `.app` the archive already contained — a LÖVE or Godot build ships one —
   * which *is* the launcher rather than something to wrap. Otherwise the answer is a
   * single executable, and "single" is the whole difficulty: an archive holding one
   * candidate is unambiguous, and where there are several the one named after the
   * game wins. Anything else is reported as not found, because launching the wrong
   * binary is worse than failing the install.
   */
  public findProgram (root: string, name: string, operatingSystem: string): FoundProgram | null {
    const executables: string[] = []
    const namedAfterTheGame: string[] = []

    this.walk(root, (filePath: string): void => {
      const fileName = path.basename(filePath)
      const lowered = fileName.toLowerCase()
      if (NEVER_A_PROGRAM.some((extension: string): boolean => lowered.endsWith(extension))) return

      if (operatingSystem === 'windows') {
        if (WINDOWS_PROGRAM_EXTENSIONS.some((extension: string): boolean => lowered.endsWith(extension))) {
          executables.push(filePath)
        }
      } else if (isExecutable(filePath)) {
        executables.push(filePath)
      }
      if (stem(fileName) === name) namedAfterTheGame.push(filePath)
    })

    const launchers = executables.filter((candidate: string): boolean =>
      stem(path.basename(candidate)) === name)
    if (launchers.length === 1 && launchers[0] !== undefined) {
      return { kind: 'exe', executablePath: launchers[0] }
    }

    if (operatingSystem === 'darwin') {
      const bundle = this.findBundle(root)
      if (bundle !== null) return { kind: 'bundle', executablePath: bundle }
    }

    for (const candidates of [executables, namedAfterTheGame]) {
      if (candidates.length === 1 && candidates[0] !== undefined) {
        return { kind: 'exe', executablePath: candidates[0] }
      }
      const exact = candidates.filter((candidate: string): boolean =>
        stem(path.basename(candidate)) === name)
      if (exact.length === 1 && exact[0] !== undefined) {
        return { kind: 'exe', executablePath: exact[0] }
      }
    }
    this.log(`found no single program to launch inside ${root}`)
    return null
  }

  /** The shallowest `.app`, without descending into one we have already found. */
  private findBundle (root: string): string | null {
    let level = [root]
    while (level.length > 0) {
      const next: string[] = []
      for (const directory of level) {
        const bundles = readDirectories(directory)
          .filter((entry: string): boolean => entry.endsWith('.app')).sort()
        const first = bundles[0]
        if (first !== undefined) return path.join(directory, first)
        for (const entry of readDirectories(directory)) next.push(path.join(directory, entry))
      }
      level = next
    }
    return null
  }

  /** Every file under `root`, never entering a `.app` bundle. */
  private walk (root: string, visit: (filePath: string) => void): void {
    const pending = [root]
    while (pending.length > 0) {
      const directory = pending.pop()
      if (directory === undefined) continue
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        const full = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.endsWith('.app')) pending.push(full)
        } else if (entry.isFile()) {
          visit(full)
        }
      }
    }
  }
}

function readDirectories (directory: string): readonly string[] {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry: fs.Dirent): boolean => entry.isDirectory())
      .map((entry: fs.Dirent): string => entry.name)
  } catch {
    return []
  }
}

function isExecutable (filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

function stem (fileName: string): string {
  return path.basename(fileName, path.extname(fileName))
}
