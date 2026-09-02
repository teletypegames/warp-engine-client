import type { ViewMode } from '../../shared/contracts/dto/AppStateDto'
import type { Locale } from '../../shared/i18n/MessageBundle'

/** What the client remembers between runs. Every field optional: a fresh install has none. */
export interface Preferences {
  readonly locale?: Locale
  readonly navigationOpen?: boolean
  readonly viewMode?: ViewMode
  /** The home of the store last opened, so the window reopens where it was left. */
  readonly storeHome?: string
}
