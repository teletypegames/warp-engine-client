import type { Preferences } from '../models/Preferences'

export interface PreferencesRepository {
  read: () => Preferences
  write: (preferences: Preferences) => void
}
