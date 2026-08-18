import { spawnSync } from 'node:child_process'
import path from 'node:path'
import type { DesktopLayout } from '../../../domain/models/DesktopLayout'
import { toSafeFileName } from '../../../domain/models/DesktopLayout'
import type { InstalledRecord } from '../../../domain/models/InstalledRecord'
import type { SelectedGame } from '../../../domain/models/SelectedGame'
import type { StoreConfiguration } from '../../../domain/models/StoreConfiguration'
import type { StoreFileSystem } from '../../files/StoreFileSystem'
import type { DesktopLayoutResolver } from '../DesktopLayoutResolver'
import { DesktopEntryWriter } from './DesktopEntryWriter'
import { MacBundleWriter } from './MacBundleWriter'
import { WindowsShortcutWriter } from './WindowsShortcutWriter'

const REFRESH_TIMEOUT_MS = 30_000

/**
 * The menu entry, in whichever form this machine's desktop understands.
 *
 * This is the whole point of a desktop store, and the one place where the three
 * hosts genuinely differ rather than merely differing in paths.
 */
export class LauncherWriter {
  private readonly desktopEntries: DesktopEntryWriter
  private readonly macBundles: MacBundleWriter
  private readonly windowsShortcuts: WindowsShortcutWriter

  public constructor (
    private readonly configuration: StoreConfiguration,
    private readonly layouts: DesktopLayoutResolver,
    files: StoreFileSystem,
    private readonly log: (line: string) => void
  ) {
    this.desktopEntries = new DesktopEntryWriter(configuration.store.id, files)
    this.macBundles = new MacBundleWriter(configuration.store.id, files, log)
    this.windowsShortcuts = new WindowsShortcutWriter(files, log)
  }

  /**
   * The published page of a browser build.
   *
   * The catalog serves these as a directory rather than an archive, so the entry is
   * a link to it — which also means a web title needs the network.
   */
  public webUrl (game: SelectedGame | InstalledRecord): string {
    const assetPath = game.assetPath.length > 0 ? game.assetPath : `/file/${game.asset}`
    return `${this.configuration.store.baseUrl}/${assetPath.replace(/^\/+|\/+$/g, '')}/`
  }

  public launcherPath (layout: DesktopLayout, game: SelectedGame | InstalledRecord): string {
    const group = this.layouts.menuGroup(layout)
    if (layout.operatingSystem === 'linux') {
      return path.join(group, `${this.configuration.store.id}-${game.name}.desktop`)
    }
    if (layout.operatingSystem === 'darwin') {
      return path.join(group, `${toSafeFileName(game.title)}.app`)
    }
    return path.join(group, `${toSafeFileName(game.title)}.lnk`)
  }

  /**
   * Write the menu entry. Returns the path actually written.
   *
   * Not always the path we intended: on Windows a `.lnk` can fall back to a `.cmd`,
   * and the state has to record what really exists or an uninstall would leave it
   * behind.
   */
  public writeLauncher (layout: DesktopLayout, record: InstalledRecord): string {
    const entryPath = this.launcherPath(layout, record)
    const url = this.webUrl(record)
    if (layout.operatingSystem === 'linux') return this.desktopEntries.write(record, entryPath, url)
    if (layout.operatingSystem === 'darwin') return this.macBundles.write(record, entryPath, url)
    return this.windowsShortcuts.write(record, entryPath, url)
  }

  /** Ask the desktop to notice the change, where that is a thing we can do. */
  public refreshMenu (layout: DesktopLayout): void {
    if (layout.operatingSystem !== 'linux') return
    try {
      spawnSync('update-desktop-database', [layout.menuDirectory], { timeout: REFRESH_TIMEOUT_MS })
    } catch {
      // Not every Linux has it, and a menu that updates on next login is fine.
      this.log('update-desktop-database is not available — the menu may need a re-login')
    }
  }
}
