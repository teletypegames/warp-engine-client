import type { Game, GameMode, UnavailableReason } from '../../domain/models/Game'
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
      hostedUrl: readOptionalString(record, 'url'),
      // Absent means installable: engines older than 1.2.0 list only what they can
      // install, and treating their silence as "unavailable" would empty the window.
      installable: readBoolean(record, 'installable', true),
      unavailableReason: this.toReason(readOptionalString(record, 'unavailable_reason')),
      unavailableDetail: readOptionalString(record, 'unavailable_detail')
    }
  }

  private toMode (value: string): GameMode {
    return value === 'web' ? 'web' : 'app'
  }

  /** The engine's snake_case codes, which are its wire format and not ours. */
  private toReason (value: string | null): UnavailableReason | null {
    const codes: Readonly<Record<string, UnavailableReason>> = {
      platform_off: 'platformOff',
      host_asset: 'hostAsset',
      no_asset: 'noAsset',
      vetoed: 'vetoed'
    }
    return value === null ? null : codes[value] ?? null
  }
}
