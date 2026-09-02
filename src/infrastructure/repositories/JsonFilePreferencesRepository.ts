import fs from 'node:fs'
import path from 'node:path'
import type { Preferences } from '../../domain/models/Preferences'
import type { ApplicationEnvironment } from '../../domain/ports/ApplicationEnvironment'
import type { PreferencesRepository } from '../../domain/ports/PreferencesRepository'
import type { ViewMode } from '../../shared/contracts/dto/AppStateDto'
import { LOCALES, type Locale } from '../../shared/i18n/MessageBundle'
import { asRecord, readBoolean, readOptionalString } from '../json/JsonRecord'

const VIEW_MODES: readonly ViewMode[] = ['grid', 'list']

const PREFERENCES_FILE_NAME = 'prefs.json'

/**
 * Preferences in one small JSON file next to the application's own data.
 *
 * A lost preference is not worth an error dialog, so both directions swallow their
 * failures — the defaults are always usable.
 */
export class JsonFilePreferencesRepository implements PreferencesRepository {
  public constructor (private readonly environment: ApplicationEnvironment) {}

  public read (): Preferences {
    try {
      const parsed = asRecord(JSON.parse(fs.readFileSync(this.filePath(), 'utf8')))
      if (parsed === null) return {}
      const locale = readOptionalString(parsed, 'locale')
      const storeHome = readOptionalString(parsed, 'storeHome')
      const preferences: {
        locale?: Locale
        navigationOpen?: boolean
        viewMode?: ViewMode
        storeHome?: string
      } = {}
      const known = LOCALES.find((candidate: Locale): boolean => candidate === locale)
      if (known !== undefined) preferences.locale = known
      if (storeHome !== null) preferences.storeHome = storeHome
      if (typeof parsed['navigationOpen'] === 'boolean') {
        preferences.navigationOpen = readBoolean(parsed, 'navigationOpen', true)
      }
      const viewMode = readOptionalString(parsed, 'viewMode')
      const knownMode = VIEW_MODES.find((candidate: ViewMode): boolean => candidate === viewMode)
      if (knownMode !== undefined) preferences.viewMode = knownMode
      return preferences
    } catch {
      return {}
    }
  }

  public write (preferences: Preferences): void {
    try {
      const target = this.filePath()
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, `${JSON.stringify(preferences, null, 2)}\n`)
    } catch {
      // Not worth interrupting the session over.
    }
  }

  private filePath (): string {
    return this.environment.resolveUserDataPath(PREFERENCES_FILE_NAME)
  }
}
