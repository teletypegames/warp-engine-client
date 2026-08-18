import type { Game, GameMode } from '../../domain/models/Game'
import {
  readBoolean, readOptionalString, readString, type JsonRecord
} from '../json/JsonRecord'

/**
 * One engine JSON entry to one domain model.
 *
 * The engine speaks snake_case and this is the only place that knows it: rename a
 * field there and this mapper is the single file that follows.
 */
export class EngineGameMapper {
  public toModel (record: JsonRecord): Game {
    return {
      name: readString(record, 'name'),
      title: readString(record, 'title'),
      platform: readString(record, 'platform'),
      version: readString(record, 'version'),
      mode: this.toMode(readString(record, 'mode')),
      kind: readString(record, 'kind'),
      description: readString(record, 'desc'),
      author: readString(record, 'author'),
      imagePath: readOptionalString(record, 'image_url'),
      installed: readBoolean(record, 'installed'),
      updateAvailable: readBoolean(record, 'update_available'),
      installedVersion: readOptionalString(record, 'installed_version'),
      menuEntryPath: readOptionalString(record, 'menu_entry'),
      executablePath: readOptionalString(record, 'exe'),
      hostedUrl: readOptionalString(record, 'url')
    }
  }

  private toMode (value: string): GameMode {
    return value === 'web' ? 'web' : 'app'
  }
}
