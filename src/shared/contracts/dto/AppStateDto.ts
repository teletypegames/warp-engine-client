import type { Locale } from '../../i18n/MessageBundle'
import type { MessageBundle } from '../../i18n/MessageBundle'
import type { BrandDto } from './BrandDto'
import type { InstalledStoreDto } from './InstalledStoreDto'

export type ViewMode = 'grid' | 'list'

/** Everything the window needs before it can paint anything. */
export interface AppStateDto {
  readonly locale: Locale
  readonly locales: readonly Locale[]
  readonly messages: MessageBundle
  readonly navigationOpen: boolean
  readonly currentStore: InstalledStoreDto | null
  readonly stores: readonly InstalledStoreDto[]
  readonly registryUrl: string
  readonly defaultStoreRoot: string
  readonly appVersion: string
  readonly viewMode: ViewMode
  readonly brand: BrandDto | null
}
