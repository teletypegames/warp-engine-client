import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Shell } from 'electron'
import type { Game } from '../../domain/models/Game'
import type { GameLauncher } from '../../domain/ports/GameLauncher'

/**
 * Launching what was installed.
 *
 * A hosted title is a URL, so it goes to the browser. A native one is whatever the
 * store recorded: on macOS the app bundle through `open`, elsewhere the executable
 * from its own directory — the same working directory the menu entry uses, because
 * games load their assets relative to it.
 */
export class ElectronGameLauncher implements GameLauncher {
  public constructor (private readonly shell: Shell) {}

  public async launchGame (game: Game): Promise<boolean> {
    if (game.mode === 'web' && game.hostedUrl !== null) {
      await this.shell.openExternal(game.hostedUrl)
      return true
    }

    const target = game.menuEntryPath ?? game.executablePath
    if (target === null || !fs.existsSync(target)) return false

    if (process.platform === 'darwin' && target.endsWith('.app')) {
      this.spawnDetached('open', [target], path.dirname(target))
      return true
    }

    if (process.platform === 'win32' || target.endsWith('.desktop')) {
      const failure = await this.shell.openPath(target)
      if (failure === '') return true
    }

    const executable = game.executablePath ?? target
    if (isBatchFile(executable)) {
      // A batch file is not a program: the kernel cannot exec it, and Node refuses to
      // pretend, so it goes through the interpreter every Windows has.
      this.spawnDetached('cmd.exe', ['/c', 'start', '', executable], path.dirname(executable))
      return true
    }
    this.spawnDetached(executable, [], path.dirname(executable))
    return true
  }

  public async openFolder (directory: string): Promise<boolean> {
    if (directory.length === 0) return false
    const failure = await this.shell.openPath(directory)
    return failure === ''
  }

  public async openUrl (url: string): Promise<boolean> {
    if (!url.startsWith('https://')) return false
    await this.shell.openExternal(url)
    return true
  }

  private spawnDetached (command: string, commandArguments: readonly string[], cwd: string): void {
    spawn(command, [...commandArguments], { cwd, detached: true, stdio: 'ignore' }).unref()
  }
}

function isBatchFile (filePath: string): boolean {
  const lowered = filePath.toLowerCase()
  return lowered.endsWith('.bat') || lowered.endsWith('.cmd')
}
