import type { Preferences } from '../../domain/models/Preferences'
import type { ApplicationEnvironment } from '../../domain/ports/ApplicationEnvironment'
import type { PreferencesRepository } from '../../domain/ports/PreferencesRepository'
import { TranslationCatalog } from '../../shared/i18n/TranslationCatalog'
import type { Locale } from '../../shared/i18n/MessageBundle'

/**
 * What the client remembers, and what it falls back to.
 *
 * The reads never fail: an unreadable file, a language that no longer exists and a
 * fresh install all produce the same defaults.
 */
export class PreferencesService {
  public constructor (
    private readonly repository: PreferencesRepository,
    private readonly environment: ApplicationEnvironment,
    private readonly translations: TranslationCatalog = new TranslationCatalog()
  ) {}

  public readLocale (): Locale {
    const stored = this.repository.read().locale
    return this.translations.resolveLocale(stored ?? this.environment.readSystemLocale())
  }

  public updateLocale (candidate: string): Locale {
    const locale = this.translations.resolveLocale(candidate)
    this.merge({ locale })
    return locale
  }

  public readNavigationOpen (): boolean {
    return this.repository.read().navigationOpen ?? true
  }

  public updateNavigationOpen (open: boolean): boolean {
    this.merge({ navigationOpen: open })
    return open
  }

  public readStoreHome (): string | null {
    return this.repository.read().storeHome ?? null
  }

  public updateStoreHome (home: string): void {
    this.merge({ storeHome: home })
  }

  private merge (changes: Preferences): void {
    this.repository.write({ ...this.repository.read(), ...changes })
  }
}
