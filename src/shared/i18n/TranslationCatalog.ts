import { ENGLISH_MESSAGES } from './EnglishMessages'
import { HUNGARIAN_MESSAGES } from './HungarianMessages'
import { LOCALES, type Locale, type MessageBundle } from './MessageBundle'

const BUNDLES: Readonly<Record<Locale, MessageBundle>> = {
  en: ENGLISH_MESSAGES,
  hu: HUNGARIAN_MESSAGES
}

const FALLBACK_LOCALE: Locale = 'en'

/**
 * Which language, and its strings.
 *
 * Used on both sides of the bridge: the main process resolves the locale and
 * ships the bundle, the window renders from it.
 */
export class TranslationCatalog {
  public readonly locales: readonly Locale[] = LOCALES

  /** A system locale like `hu-HU`, or anything at all, mapped onto a language. */
  public resolveLocale (candidate: string | null | undefined): Locale {
    const short = (candidate ?? '').slice(0, 2).toLowerCase()
    return LOCALES.find((locale: Locale): boolean => locale === short) ?? FALLBACK_LOCALE
  }

  public readBundle (candidate: string | null | undefined): MessageBundle {
    return BUNDLES[this.resolveLocale(candidate)]
  }
}
