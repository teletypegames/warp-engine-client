import fs from 'node:fs'
import path from 'node:path'
import type { InstalledRecord } from '../../../domain/models/InstalledRecord'
import { WEB_MODE } from '../../../domain/models/StoreConfiguration'
import type { StoreFileSystem } from '../../files/StoreFileSystem'
import { quoteForShell } from './ShellQuoting'

const LAUNCHER_MODE = 0o755
const COMMENT_LIMIT = 120

/**
 * Linux: an XDG desktop entry.
 *
 * `Path=` is what gives the game its working directory — a Godot or LÖVE build
 * looks for its `.pck` next to the binary, and started from anywhere else it exits
 * without a window and without a message.
 */
export class DesktopEntryWriter {
  public constructor (
    private readonly storeId: string,
    private readonly files: StoreFileSystem
  ) {}

  public write (record: InstalledRecord, entryPath: string, webUrl: string): string {
    const lines: string[] = ['[Desktop Entry]', 'Type=Application', 'Version=1.0', `Name=${record.title}`]

    if (record.description.length > 0) {
      // One line only, and short: the menu shows it as a tooltip.
      const firstLine = record.description.split('\n')[0] ?? ''
      lines.push(`Comment=${firstLine.slice(0, COMMENT_LIMIT)}`)
    }
    if (record.mode === WEB_MODE) {
      lines.push(`Exec=xdg-open ${quoteForShell(webUrl)}`)
    } else if (record.executable !== null) {
      lines.push(`Exec=${quoteForShell(record.executable)}`)
      lines.push(`Path=${quoteForShell(path.dirname(record.executable))}`)
    }
    if (record.icon !== null) lines.push(`Icon=${record.icon}`)
    lines.push('Terminal=false', 'Categories=Game;', `X-WarpStore=${this.storeId}`, '')

    fs.mkdirSync(path.dirname(entryPath), { recursive: true })
    this.files.writeAtomic(entryPath, Buffer.from(lines.join('\n'), 'utf8'), LAUNCHER_MODE)
    return entryPath
  }
}
