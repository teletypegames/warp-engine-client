import fs from 'node:fs'
import path from 'node:path'
import { describeError } from '../../domain/errors/DescribeError'
import { asRecord, readString } from '../json/JsonRecord'
import { isWithin } from './Paths'

/**
 * The mode an atomic write lands on when the caller names none.
 *
 * The shell engine's writes went through `mkstemp`, which creates at 0600, and its
 * `state.json` and box art carry that mode on every machine this store has ever run
 * on. Matching it keeps "the same files, in the same shape" literally true — and for
 * a state file that records what is installed under someone's home directory, the
 * more private of the two defaults is the better one anyway.
 */
const PRIVATE_FILE_MODE = 0o600

/**
 * The filesystem rules a store writes by.
 *
 * Three of them are safety rather than taste, and they are the reason this is one
 * class instead of scattered `fs` calls:
 *
 *   - **nothing is written in place.** A store interrupted mid-sync would otherwise
 *     leave a half-written menu entry, which is worse than an old one;
 *   - **every delete is guarded by `within`.** A store may only remove files from
 *     the subtree it owns, never from the user's own library;
 *   - **only empty directories are pruned.** One surprise file is enough to keep a
 *     directory.
 */
export class StoreFileSystem {
  public constructor (
    private readonly tag: string,
    private readonly log: (line: string) => void
  ) {}

  public readJson (filePath: string): unknown {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (error: unknown) {
      if (isMissingFile(error)) return null
      this.log(`warning: cannot read ${filePath}: ${describeError(error)}`)
      return null
    }
  }

  public writeJson (filePath: string, data: unknown): void {
    this.writeAtomic(filePath, Buffer.from(`${JSON.stringify(data, null, 2)}\n`, 'utf8'))
  }

  /** Write bytes via a temp file in the same directory, then rename over the target. */
  public writeAtomic (filePath: string, blob: Buffer, mode: number = PRIVATE_FILE_MODE): string {
    const directory = path.dirname(filePath)
    fs.mkdirSync(directory, { recursive: true })
    const temporary = path.join(directory, `.${this.tag}-${process.pid.toString(36)}-${counter()}.tmp`)
    try {
      fs.writeFileSync(temporary, blob, { mode })
      // The mode is set again: `writeFileSync` applies the umask to it, and a launcher
      // that is not executable is not a launcher.
      fs.chmodSync(temporary, mode)
      fs.renameSync(temporary, filePath)
    } catch (error: unknown) {
      fs.rmSync(temporary, { force: true })
      throw error
    }
    return filePath
  }

  /**
   * Remove a file, a symlink or a directory tree — but only inside `root`.
   *
   * Returns whether anything went. A symlink is unlinked rather than followed: on
   * macOS a menu entry may be a link to the archive's own `.app`, and removing the
   * store's entry must not touch what it points at.
   */
  public removeWithin (target: string, root: string): boolean {
    if (!isWithin(target, root)) {
      this.log(`warning: refusing to delete ${target} (outside ${root})`)
      return false
    }
    const stats = statOrNull(target)
    if (stats === null) return false
    if (stats.isDirectory() && !stats.isSymbolicLink()) {
      fs.rmSync(target, { recursive: true, force: true })
    } else {
      fs.rmSync(target, { force: true })
    }
    return true
  }

  /**
   * Remove those of `directories` that are now empty, deepest first.
   *
   * A store that has uninstalled everything should not leave its folders behind.
   */
  public pruneEmptyDirectories (directories: readonly string[], root: string): void {
    const ordered = [...new Set(directories.filter((entry: string): boolean => entry.length > 0)
      .map((entry: string): string => path.resolve(entry)))]
      .sort((left: string, right: string): number => depth(right) - depth(left))

    for (const directory of ordered) {
      if (!isWithin(directory, root)) {
        this.log(`warning: refusing to remove ${directory} (outside ${root})`)
        continue
      }
      const stats = statOrNull(directory)
      if (stats?.isDirectory() !== true) continue
      if (fs.readdirSync(directory).length > 0) continue
      try {
        fs.rmdirSync(directory)
      } catch {
        // A directory that will not go is not a failure worth reporting: the next
        // sync finds it again, and an uninstall has already done its real work.
      }
    }
  }

  public resolveTemporaryPath (directory: string, label: string, suffix: string): string {
    return path.join(directory, `.${this.tag}-${label}${suffix}`)
  }
}


function statOrNull (target: string): fs.Stats | null {
  try {
    return fs.lstatSync(target)
  } catch {
    return null
  }
}

function depth (value: string): number {
  return value.split(path.sep).length
}

function isMissingFile (error: unknown): boolean {
  const record = asRecord(error)
  return record !== null && readString(record, 'code') === 'ENOENT'
}


let sequence = 0
function counter (): string {
  sequence += 1
  return sequence.toString(36)
}
