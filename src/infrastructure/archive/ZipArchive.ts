import { inflateRawSync } from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'

/**
 * A zip reader over `node:zlib`, because Node has no zip and this client has no
 * runtime dependencies.
 *
 * Only what the store actually needs to read: the archives come from our own
 * release pipeline, so `stored` and `deflate` are the only compression methods
 * that occur and there is no encryption to support. What is *not* optional is the
 * unix mode — the archive records the executable bit and without it nothing we
 * install can start, so every entry is read from the central directory, which is
 * the only place that carries it.
 *
 * Symlinks are restored as symlinks when the archive marks them as such in the unix
 * mode — a macOS framework inside an `.app` is a tree of them, and a framework whose
 * `Versions/Current` is a text file is a framework `dyld` may still load but
 * `codesign` no longer recognises. A link that would point outside the destination is
 * refused like any other path that would.
 */

const END_OF_CENTRAL_DIRECTORY = 0x06054b50
const CENTRAL_FILE_HEADER = 0x02014b50
const LOCAL_FILE_HEADER = 0x04034b50

const END_OF_CENTRAL_DIRECTORY_SIZE = 22
const CENTRAL_FILE_HEADER_SIZE = 46
const LOCAL_FILE_HEADER_SIZE = 30

/** A zip comment is a u16 length, so the record cannot start further back than this. */
const MAX_COMMENT_SIZE = 0xffff

const STORED = 0
const DEFLATED = 8

/** The u16/u32 sentinels a zip64 archive puts in the fields it has outgrown. */
const ZIP64_U16 = 0xffff
const ZIP64_U32 = 0xffffffff

const DEFAULT_FILE_MODE = 0o644
const DEFAULT_DIRECTORY_MODE = 0o755
const EXECUTABLE_BITS = 0o111
const FILE_TYPE_MASK = 0o170000
const SYMLINK_TYPE = 0o120000

export interface ZipEntry {
  readonly fileName: string
  readonly directory: boolean
  readonly compressionMethod: number
  readonly compressedSize: number
  readonly uncompressedSize: number
  /** From the external attributes' high word; 0 when the archive carries no unix mode. */
  readonly unixMode: number
  readonly symlink: boolean
  readonly localHeaderOffset: number
}

export class ZipArchive {
  private constructor (
    private readonly buffer: Buffer,
    public readonly entries: readonly ZipEntry[]
  ) {}

  public static open (archivePath: string): ZipArchive {
    const buffer = fs.readFileSync(archivePath)
    return new ZipArchive(buffer, readCentralDirectory(buffer, archivePath))
  }

  /**
   * Unpack everything into `destination`, restoring the executable bit.
   *
   * Every entry path is resolved and checked against the destination before it is
   * written: a zip may name `../` and this store writes into the user's own data
   * directory.
   */
  public extractAll (destination: string): void {
    const root = path.resolve(destination)
    fs.mkdirSync(root, { recursive: true })

    for (const entry of this.entries) {
      const target = path.resolve(root, entry.fileName)
      if (target !== root && !target.startsWith(root + path.sep)) {
        throw new Error(`${entry.fileName} would be written outside ${root}`)
      }
      if (entry.directory) {
        fs.mkdirSync(target, { recursive: true, mode: DEFAULT_DIRECTORY_MODE })
        continue
      }
      fs.mkdirSync(path.dirname(target), { recursive: true })
      if (entry.symlink) {
        this.writeSymlink(entry, target, root)
        continue
      }
      fs.writeFileSync(target, this.readEntry(entry), { mode: this.fileMode(entry) })
    }
  }

  private writeSymlink (entry: ZipEntry, target: string, root: string): void {
    const linkTarget = this.readEntry(entry).toString('utf8')
    const resolved = path.resolve(path.dirname(target), linkTarget)
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error(`${entry.fileName} would link outside ${root}`)
    }
    fs.rmSync(target, { force: true })
    fs.symlinkSync(linkTarget, target)
  }

  /** One entry's bytes, decompressed. */
  public readEntry (entry: ZipEntry): Buffer {
    const signature = this.buffer.readUInt32LE(entry.localHeaderOffset)
    if (signature !== LOCAL_FILE_HEADER) {
      throw new Error(`${entry.fileName}: no local header at ${String(entry.localHeaderOffset)}`)
    }
    // The local header's own sizes may be zero when a data descriptor follows, so
    // the lengths come from the central directory and only the two variable-length
    // fields are read here.
    const nameLength = this.buffer.readUInt16LE(entry.localHeaderOffset + 26)
    const extraLength = this.buffer.readUInt16LE(entry.localHeaderOffset + 28)
    const start = entry.localHeaderOffset + LOCAL_FILE_HEADER_SIZE + nameLength + extraLength
    const raw = this.buffer.subarray(start, start + entry.compressedSize)

    if (entry.compressionMethod === STORED) return Buffer.from(raw)
    if (entry.compressionMethod === DEFLATED) return inflateRawSync(raw)
    throw new Error(`${entry.fileName}: unsupported compression method ${String(entry.compressionMethod)}`)
  }

  /**
   * The mode to write a file with.
   *
   * A zip made on Windows carries no unix mode at all, and there the archive
   * simply cannot tell us — 0644 is the safe answer, and `find_program` looks for
   * `.exe` on that host anyway rather than for the executable bit.
   */
  private fileMode (entry: ZipEntry): number {
    if (entry.unixMode === 0) return DEFAULT_FILE_MODE
    const permissions = entry.unixMode & 0o7777
    if (permissions === 0) return DEFAULT_FILE_MODE
    return (permissions & EXECUTABLE_BITS) === 0 ? permissions : permissions | EXECUTABLE_BITS
  }
}

function readCentralDirectory (buffer: Buffer, archivePath: string): readonly ZipEntry[] {
  const end = findEndOfCentralDirectory(buffer, archivePath)
  const entryCount = buffer.readUInt16LE(end + 10)
  const directoryOffset = buffer.readUInt32LE(end + 16)

  if (entryCount === ZIP64_U16 || directoryOffset === ZIP64_U32) {
    throw new Error(`${archivePath} is a zip64 archive, which this reader does not support`)
  }

  const entries: ZipEntry[] = []
  let cursor = directoryOffset
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + CENTRAL_FILE_HEADER_SIZE > buffer.length) {
      throw new Error(`${archivePath}: the central directory ends mid-entry`)
    }
    if (buffer.readUInt32LE(cursor) !== CENTRAL_FILE_HEADER) {
      throw new Error(`${archivePath}: no central directory entry at ${String(cursor)}`)
    }
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const fileName = buffer.toString('utf8', cursor + CENTRAL_FILE_HEADER_SIZE, cursor + CENTRAL_FILE_HEADER_SIZE + nameLength)
    const unixMode = buffer.readUInt32LE(cursor + 38) >>> 16

    entries.push({
      fileName,
      directory: fileName.endsWith('/'),
      compressionMethod: buffer.readUInt16LE(cursor + 10),
      compressedSize: buffer.readUInt32LE(cursor + 20),
      uncompressedSize: buffer.readUInt32LE(cursor + 24),
      unixMode,
      symlink: (unixMode & FILE_TYPE_MASK) === SYMLINK_TYPE,
      localHeaderOffset: buffer.readUInt32LE(cursor + 42)
    })
    cursor += CENTRAL_FILE_HEADER_SIZE + nameLength + extraLength + commentLength
  }
  return entries
}

/** The record is at the end, behind a comment of unknown length, so scan backwards. */
function findEndOfCentralDirectory (buffer: Buffer, archivePath: string): number {
  const earliest = Math.max(0, buffer.length - END_OF_CENTRAL_DIRECTORY_SIZE - MAX_COMMENT_SIZE)
  for (let offset = buffer.length - END_OF_CENTRAL_DIRECTORY_SIZE; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) return offset
  }
  throw new Error(`${archivePath} is not a zip archive`)
}
