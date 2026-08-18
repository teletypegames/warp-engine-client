import type { StorePaths } from '../../domain/models/StorePaths'
import { readRecord, readString, type JsonRecord } from '../json/JsonRecord'

/** The engine's `paths` answer to one domain model. */
export class EngineStorePathsMapper {
  public toModel (record: JsonRecord): StorePaths {
    const store = readRecord(record, 'store')
    return {
      operatingSystem: readString(record, 'os'),
      architecture: readString(record, 'arch'),
      installRoot: readString(record, 'install_root'),
      menuDirectory: readString(record, 'menu_dir'),
      storeFolder: readString(record, 'store_folder'),
      menuGroup: readString(record, 'menu_group'),
      catalogBaseUrl: store === null ? '' : readString(store, 'base_url'),
      storeName: store === null ? '' : readString(store, 'name'),
      storeId: store === null ? '' : readString(store, 'id')
    }
  }
}
