import type { Locale } from '../../i18n/MessageBundle'
import type { MessageBundle } from '../../i18n/MessageBundle'
import type { EngineVersionDto } from './EngineVersionDto'
import type { InstalledStoreDto } from './InstalledStoreDto'

/** Everything the window needs before it can paint anything. */
export interface AppStateDto {
  readonly locale: Locale
  readonly locales: readonly Locale[]
  readonly messages: MessageBundle
  readonly navigationOpen: boolean
  /** The Python 3 version string, or null when there is none to drive the store. */
  readonly pythonVersion: string | null
  readonly currentStore: InstalledStoreDto | null
  readonly stores: readonly InstalledStoreDto[]
  readonly engine: EngineVersionDto | null
  readonly minimumEngineVersion: string
  readonly registryUrl: string
  readonly defaultStoreRoot: string
  readonly appVersion: string
}
