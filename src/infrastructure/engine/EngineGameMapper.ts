import type { Game, GameMode } from '../../domain/models/Game'
import { gameKey, type InstalledRecord } from '../../domain/models/InstalledRecord'
import type { SelectedGame, UnavailableEntry } from '../../domain/models/SelectedGame'
import type { ServiceDescriptor } from '../../domain/models/ServiceDescriptor'
import type { StoreAccount } from '../../domain/models/StoreAccount'
import { APP_MODE, WEB_MODE } from '../../domain/models/StoreConfiguration'
import type { CatalogVocabulary } from './CatalogVocabulary'
import type { PlatformLabels } from './PlatformLabels'

/**
 * What the engine found, as the `Game` the rest of the application reads.
 *
 * The engine's own records — a survey entry, the state file's record of an install, the
 * catalog's platform labels — meet here and nowhere else. The gateway hands over what it
 * has and gets back the model; it does not assemble one field by field.
 */
export class EngineGameMapper {
  public toGame (
    game: SelectedGame,
    installed: ReadonlyMap<string, InstalledRecord>,
    labels: PlatformLabels,
    vocabulary: CatalogVocabulary,
    resolveWebUrl: (game: SelectedGame) => string
  ): Game {
    const record = installed.get(gameKey(game)) ?? null
    return {
      name: game.name,
      title: game.title,
      platform: game.platform,
      platformLabel: labels.describePlatform(game.platform),
      version: game.version,
      mode: toMode(game.mode),
      kind: game.kind,
      description: game.description,
      author: game.author,
      category: game.category,
      categoryLabel: game.category === null ? null : vocabulary.describeCategory(game.category),
      imagePath: game.imageUrl,
      installed: record !== null,
      updateAvailable: record !== null && record.asset !== game.asset,
      installedVersion: record?.version ?? null,
      menuEntryPath: record?.menuEntry ?? null,
      executablePath: record?.executable ?? null,
      // The catalog's own play address wins where it gives one: a store that gates its
      // web builds serves them from a page that knows how to ask somebody to sign in,
      // and the raw /file/ directory under it does not.
      hostedUrl: game.mode === WEB_MODE
        ? game.access?.webUrl ?? resolveWebUrl(game)
        : null,
      installable: true,
      unavailableReason: null,
      unavailableDetail: null,
      access: game.access
    }
  }

  /**
   * A title this machine cannot install, in the same shape as an installable one.
   *
   * The mode is `app` for want of a truer answer: a title with no build has no mode,
   * and nothing reads this one because `installable` is false.
   */
  public toUnavailableGame (entry: UnavailableEntry, labels: PlatformLabels, vocabulary: CatalogVocabulary): Game {
    return {
      name: entry.name,
      title: entry.title,
      platform: entry.platform,
      platformLabel: labels.describePlatform(entry.platform),
      version: entry.version,
      mode: APP_MODE,
      kind: '',
      description: entry.description,
      author: entry.author,
      category: entry.category,
      categoryLabel: entry.category === null ? null : vocabulary.describeCategory(entry.category),
      imagePath: entry.imageUrl,
      installed: false,
      updateAvailable: false,
      installedVersion: null,
      menuEntryPath: null,
      executablePath: null,
      hostedUrl: null,
      installable: false,
      unavailableReason: entry.reason,
      unavailableDetail: entry.detail,
      access: entry.access
    }
  }

  /**
   * Holding a token for a store that has no sign-in is not being signed in.
   *
   * It happens: a store can lose its identity configuration, or a client can keep a
   * token from before. Reporting it as signed in would offer a "sign out" for a door
   * that is no longer there.
   */
  public toAccount (descriptor: ServiceDescriptor, token: string | null): StoreAccount {
    const available = descriptor.auth !== null
    return { signInAvailable: available, signedIn: available && token !== null }
  }
}

function toMode (mode: string): GameMode {
  return mode === WEB_MODE ? WEB_MODE : APP_MODE
}
