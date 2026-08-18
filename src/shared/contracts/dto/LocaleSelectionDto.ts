import type { Locale, MessageBundle } from '../../i18n/MessageBundle'

/** The answer to a language change: what was stored, and the strings for it. */
export interface LocaleSelectionDto {
  readonly locale: Locale
  readonly messages: MessageBundle
}
