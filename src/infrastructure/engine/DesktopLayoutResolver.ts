import path from 'node:path'
import {
  OPERATING_SYSTEM_PATHS, toSafeFileName, type DesktopLayout
} from '../../domain/models/DesktopLayout'
import type { InstalledRecord } from '../../domain/models/InstalledRecord'
import type { SelectedGame } from '../../domain/models/SelectedGame'
import type { StoreConfiguration } from '../../domain/models/StoreConfiguration'
import { expandHome, expandPathSpecification } from '../files/Paths'
import type { HostMachineDetector } from './HostMachineDetector'

/**
 * Where this store writes on this machine.
 *
 * The XDG and Windows environment variables are the correct answer when they are
 * set, and a hardcoded path is only the fallback: a machine that moved its data
 * directory should still get its own menu. A value pinned in the config beats both.
 */
export class DesktopLayoutResolver {
  public constructor (
    private readonly configuration: StoreConfiguration,
    private readonly hosts: HostMachineDetector
  ) {}

  public resolveLayout (): DesktopLayout {
    const operatingSystem = this.hosts.findHost().operatingSystem
    const defaults = OPERATING_SYSTEM_PATHS[operatingSystem]
    if (defaults === undefined) {
      throw new Error(
        `no desktop layout is known for '${operatingSystem}' — set paths.install_root and paths.menu_dir`)
    }
    const sources: Record<string, string> = { os: operatingSystem }

    const pick = (key: 'installRoot' | 'menuDirectory' | 'iconDirectory'): string | null => {
      const configured = this.configuration.paths[key]
      if (configured !== null && configured.length > 0) {
        sources[key] = 'config'
        return path.resolve(expandHome(configured))
      }
      sources[key] = 'default'
      return expandPathSpecification(defaults[key] ?? null)
    }

    const installRoot = pick('installRoot')
    const menuDirectory = pick('menuDirectory')
    const iconDirectory = pick('iconDirectory')
    if (installRoot === null || menuDirectory === null) {
      throw new Error(`cannot resolve the install root or menu directory for '${operatingSystem}'`)
    }
    return { operatingSystem, installRoot, menuDirectory, iconDirectory, sources }
  }

  /** The only payload subtree this store may delete from. */
  public resolveOwnedRoot (layout: DesktopLayout): string {
    return path.join(layout.installRoot, this.configuration.paths.subfolder)
  }

  public resolvePayloadDirectory (layout: DesktopLayout, game: SelectedGame | InstalledRecord): string {
    return path.join(this.resolveOwnedRoot(layout), game.name)
  }

  /**
   * Box art path.
   *
   * Kept inside our own folder rather than the shared icon theme, so an uninstall
   * never has to reach into it.
   */
  public resolveIconPath (layout: DesktopLayout, game: SelectedGame | InstalledRecord): string {
    return path.join(this.resolveOwnedRoot(layout), 'icons', `${game.name}.png`)
  }

  /** Windows puts programs in a Start-menu folder; the others do not. */
  public resolveMenuGroup (layout: DesktopLayout): string {
    if (layout.operatingSystem === 'windows') {
      return path.join(layout.menuDirectory, toSafeFileName(this.configuration.store.name))
    }
    return layout.menuDirectory
  }
}
