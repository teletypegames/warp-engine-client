/**
 * The three places a desktop store writes, resolved for this machine.
 *
 * `installRoot` holds the payloads and `menuDirectory` the launchers the user
 * actually sees. `sources` records where each answer came from — a default, the
 * config or an override — because "why is my menu entry there" is the first
 * question anyone asks of a store that writes outside its own folder.
 */
export interface DesktopLayout {
  readonly operatingSystem: string
  readonly installRoot: string
  readonly menuDirectory: string
  readonly iconDirectory: string | null
  readonly sources: Readonly<Record<string, string>>
}

/** Where each OS keeps installed programs and its application menu. */
export const OPERATING_SYSTEM_PATHS: Readonly<Record<string, Readonly<Record<string, string | null>>>> = {
  linux: {
    installRoot: '$XDG_DATA_HOME|~/.local/share',
    menuDirectory: '$XDG_DATA_HOME|~/.local/share/applications',
    iconDirectory: '$XDG_DATA_HOME|~/.local/share/icons'
  },
  darwin: {
    installRoot: '~/Library/Application Support',
    menuDirectory: '~/Applications',
    iconDirectory: null
  },
  windows: {
    installRoot: '$LOCALAPPDATA|~/AppData/Local',
    menuDirectory: '$APPDATA|~/AppData/Roaming/Microsoft/Windows/Start Menu/Programs',
    iconDirectory: null
  }
}

/** A file name the OS will accept, from a human title. */
export function toSafeFileName (text: string): string {
  return text.trim().replace(/[\\/:*?"<>|]/g, '_') || 'game'
}
