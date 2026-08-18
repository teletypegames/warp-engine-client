import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { InstalledRecord } from '../../../domain/models/InstalledRecord'
import { WEB_MODE } from '../../../domain/models/StoreConfiguration'
import type { StoreFileSystem } from '../../files/StoreFileSystem'
import { quoteForPowerShell } from './ShellQuoting'

const POWERSHELL_TIMEOUT_MS = 60_000
const DESCRIPTION_LIMIT = 250

/**
 * Windows: a real `.lnk` through PowerShell, or a `.cmd` if that is missing.
 *
 * A `.lnk` is the only artifact that carries a working directory *and* shows up the
 * way users expect, but it is a binary format with no writer in the standard library
 * of any language here — PowerShell's `WScript.Shell` is the one tool every Windows
 * has. When even that is unavailable a `.cmd` still appears in the Start menu, which
 * is worth more than a correct file nobody can see.
 */
export class WindowsShortcutWriter {
  public constructor (
    private readonly files: StoreFileSystem,
    private readonly log: (line: string) => void
  ) {}

  public write (record: InstalledRecord, shortcutPath: string, webUrl: string): string {
    const target = record.mode === WEB_MODE ? webUrl : record.executable ?? ''
    const workingDirectory = record.mode === WEB_MODE || record.executable === null
      ? ''
      : path.dirname(record.executable)

    fs.mkdirSync(path.dirname(shortcutPath), { recursive: true })
    if (this.writeShortcut(record, shortcutPath, target, workingDirectory)) return shortcutPath
    return this.writeCommandFile(record, shortcutPath, target, workingDirectory)
  }

  private writeShortcut (
    record: InstalledRecord,
    shortcutPath: string,
    target: string,
    workingDirectory: string
  ): boolean {
    const script = [
      `$s = (New-Object -ComObject WScript.Shell).CreateShortcut(${quoteForPowerShell(shortcutPath)});`,
      `$s.TargetPath = ${quoteForPowerShell(target)};`,
      workingDirectory.length > 0 ? `$s.WorkingDirectory = ${quoteForPowerShell(workingDirectory)};` : '',
      `$s.Description = ${quoteForPowerShell(record.title.slice(0, DESCRIPTION_LIMIT))};`,
      '$s.Save()'
    ].join('')

    try {
      const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
        timeout: POWERSHELL_TIMEOUT_MS
      })
      if (result.status === 0 && fs.existsSync(shortcutPath)) return true
      this.log(`powershell could not write ${shortcutPath}`)
    } catch {
      this.log('powershell is not available — falling back to a .cmd launcher')
    }
    return false
  }

  private writeCommandFile (
    record: InstalledRecord,
    shortcutPath: string,
    target: string,
    workingDirectory: string
  ): string {
    const commandPath = `${shortcutPath.slice(0, shortcutPath.length - path.extname(shortcutPath).length)}.cmd`
    const body = record.mode === WEB_MODE || workingDirectory.length === 0
      ? `@echo off\r\nstart "" "${target}"\r\n`
      : `@echo off\r\ncd /d "${workingDirectory}"\r\nstart "" "${target}"\r\n`
    this.files.writeAtomic(commandPath, Buffer.from(body, 'utf8'))
    this.log(`wrote a .cmd launcher instead of a .lnk: ${commandPath}`)
    return commandPath
  }
}
