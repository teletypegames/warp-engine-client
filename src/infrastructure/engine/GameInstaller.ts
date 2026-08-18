import fs from 'node:fs'
import path from 'node:path'
import type { DesktopLayout } from '../../domain/models/DesktopLayout'
import type { EngineProgressListener } from '../../domain/models/EngineProgress'
import { gameKey, type InstalledRecord } from '../../domain/models/InstalledRecord'
import type { SelectedGame } from '../../domain/models/SelectedGame'
import { APP_MODE, type StoreConfiguration } from '../../domain/models/StoreConfiguration'
import { describe, type StoreFileSystem } from '../files/StoreFileSystem'
import type { CatalogClient } from './CatalogClient'
import type { DesktopLayoutResolver } from './DesktopLayoutResolver'
import type { LauncherWriter } from './launchers/LauncherWriter'
import type { PayloadInstaller } from './PayloadInstaller'

/**
 * Installing and uninstalling one title, and the sweep over all of them.
 *
 * The rule the whole class turns on: an install writes three things — a payload, an
 * icon and a menu entry — and the record of what was written is what an uninstall
 * reads. Nothing is ever deleted by reconstructing a path from a name, because a
 * path built from a name is a guess and this runs inside the user's home directory.
 */
export class GameInstaller {
  public constructor (
    private readonly configuration: StoreConfiguration,
    private readonly layouts: DesktopLayoutResolver,
    private readonly payloads: PayloadInstaller,
    private readonly launchers: LauncherWriter,
    private readonly catalog: CatalogClient,
    private readonly files: StoreFileSystem,
    private readonly log: (line: string) => void
  ) {}

  /**
   * Install every game in `games`, updating `installed` in place.
   *
   * Returns whether anything changed, which is what decides between "done" and
   * "already up to date" — a sync that rewrites nothing should say so.
   */
  public async installAll (
    layout: DesktopLayout,
    games: readonly SelectedGame[],
    installed: Map<string, InstalledRecord>,
    prune: boolean,
    progress: EngineProgressListener
  ): Promise<boolean> {
    let changed = false
    let failed = 0
    progress.onEvent?.({ event: 'plan', count: games.length })

    for (const game of games) {
      const key = gameKey(game)
      let previous = installed.get(key) ?? null

      // A different asset or a different mode is not an update in place: the old
      // payload and the old kind of menu entry both have to go first.
      if (previous !== null && (previous.asset !== game.asset || previous.mode !== game.mode)) {
        this.log(`${game.name}: ${previous.version} (${previous.mode}) -> ` +
          `${game.version} (${game.mode}), removing the old install`)
        this.removeGame(layout, previous)
        previous = null
        changed = true
      }

      progress.onEvent?.({ event: 'begin', name: game.name, title: game.title })
      try {
        const result = await this.installGame(layout, game, previous)
        progress.onEvent?.({
          event: 'installed', name: game.name, title: game.title, changed: result.changed
        })
        if (result.changed || !sameRecord(installed.get(key) ?? null, result.record)) changed = true
        installed.set(key, result.record)
      } catch (error: unknown) {
        failed += 1
        const reason = describe(error)
        this.log(`warning: ${game.name} failed: ${reason}`)
        progress.onEvent?.({ event: 'failed', name: game.name, error: reason })
      }
    }

    if (prune) {
      const keep = new Set(games.map((game: SelectedGame): string => gameKey(game)))
      for (const [key, record] of [...installed]) {
        if (keep.has(key)) continue
        this.log(`pruning ${key} (no longer in the catalog or filtered out)`)
        this.removeGame(layout, record)
        progress.onEvent?.({ event: 'pruned', name: record.name })
        installed.delete(key)
        changed = true
      }
    }

    progress.onEvent?.({ event: 'finished', installed: installed.size, failed })
    return changed
  }

  /** Install one title in its chosen mode. */
  public async installGame (
    layout: DesktopLayout,
    game: SelectedGame,
    previous: InstalledRecord | null
  ): Promise<{ readonly record: InstalledRecord; readonly changed: boolean }> {
    const payloadDirectory = this.layouts.payloadDirectory(layout, game)
    let changed = false
    let payload: string | null = null
    let executable: string | null = null
    let executableKind: string | null = null
    let url: string | null = null

    if (game.mode === APP_MODE) {
      if (previous !== null && isStillInstalled(previous, game, payloadDirectory)) {
        executable = previous.executable
        executableKind = previous.executableKind
      } else {
        const size = await this.payloads.unpack(game, payloadDirectory)
        changed = true
        const program = this.payloads.findProgram(payloadDirectory, game.name, layout.operatingSystem)
        if (program === null) {
          fs.rmSync(payloadDirectory, { recursive: true, force: true })
          throw new Error(`no program was found inside ${game.asset}`)
        }
        executable = program.executablePath
        executableKind = program.kind
        this.log(`installed ${game.name} ${game.version} (${String(size)} bytes) -> ${payloadDirectory}`)
      }
      payload = payloadDirectory
    } else {
      // Nothing to unpack: the browser build is hosted, so the entry is a link.
      url = this.launchers.webUrl(game)
      if (previous?.url !== url) {
        changed = true
        this.log(`added ${game.name} ${game.version} as a web entry -> ${url}`)
      }
    }

    const withoutMenu: InstalledRecord = {
      ...game,
      payload,
      executable,
      executableKind,
      icon: await this.installIcon(layout, game),
      menuEntry: null,
      url
    }
    const menuEntry = this.launchers.writeLauncher(layout, withoutMenu)
    if ((previous?.menuEntry ?? null) !== menuEntry) changed = true

    return { record: { ...withoutMenu, menuEntry }, changed }
  }

  /** Delete one title's payload, icon and menu entry — and nothing else. */
  public removeGame (layout: DesktopLayout, record: InstalledRecord): void {
    const owned = this.layouts.ownedRoot(layout)
    for (const target of [record.payload, record.icon]) {
      if (target !== null) this.files.removeWithin(target, owned)
    }
    if (record.menuEntry !== null) {
      this.files.removeWithin(record.menuEntry, layout.menuDirectory)
    }
  }

  /** Remove everything this store installed, folders included. */
  public purge (layout: DesktopLayout, installed: Map<string, InstalledRecord>): void {
    for (const [key, record] of [...installed]) {
      this.removeGame(layout, record)
      installed.delete(key)
    }
    const owned = this.layouts.ownedRoot(layout)
    this.files.pruneEmptyDirectories([path.join(owned, 'icons'), owned], layout.installRoot)
    if (layout.operatingSystem === 'windows') {
      this.files.pruneEmptyDirectories([this.layouts.menuGroup(layout)], layout.menuDirectory)
    }
  }

  private async installIcon (layout: DesktopLayout, game: SelectedGame): Promise<string | null> {
    if (game.imageUrl === null) return null
    const iconPath = this.layouts.iconPath(layout, game)
    if (hasContent(iconPath)) return iconPath

    const image = await this.catalog.downloadImage(game.imageUrl, game.name)
    if (image === null) return null
    // The name says .png because that is what a desktop entry and `sips` expect; a
    // non-PNG cover still displays on Linux, which sniffs the content.
    this.files.writeAtomic(iconPath, image.body)
    return iconPath
  }
}

/**
 * Whether the previous install is still there and still the right one.
 *
 * All four conditions matter: the same asset, a payload directory that exists, a
 * recorded executable, and that executable still on disk. A user who deleted the
 * folder by hand should get a reinstall rather than a menu entry that does nothing.
 */
function isStillInstalled (
  previous: InstalledRecord,
  game: SelectedGame,
  payloadDirectory: string
): boolean {
  return previous.asset === game.asset &&
    fs.existsSync(payloadDirectory) &&
    previous.executable !== null &&
    fs.existsSync(previous.executable)
}

function hasContent (filePath: string): boolean {
  try {
    return fs.statSync(filePath).size > 0
  } catch {
    return false
  }
}

function sameRecord (left: InstalledRecord | null, right: InstalledRecord): boolean {
  return left !== null && JSON.stringify(left) === JSON.stringify(right)
}
