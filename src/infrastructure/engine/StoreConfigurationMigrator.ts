import { asRecord, readRecord } from '../json/JsonRecord'
import type { StoreFileSystem } from '../files/StoreFileSystem'

/**
 * The status list 3.1.0 and earlier wrote into every store they set up.
 *
 * It was the client's guess at what a catalog means to be played, written down as if
 * the store had chosen it. The catalog says that itself now, in its vocabulary.
 */
const WRITTEN_STATUSES: readonly string[] = ['released', 'archived', 'demo']

/**
 * Takes out of a store's `config.json` what an older client put there on its own behalf.
 *
 * Only the exact list the installer wrote goes: a list somebody edited is their choice
 * and stays. Run before every read, which costs one small file read once the config is
 * clean.
 */
export class StoreConfigurationMigrator {
  public constructor (
    private readonly files: StoreFileSystem,
    private readonly log: (line: string) => void
  ) {}

  public migrate (configPath: string): void {
    const record = asRecord(this.files.readJson(configPath))
    if (record === null) return
    const catalog = readRecord(record, 'catalog')
    if (catalog === null || !isWrittenStatuses(catalog['statuses'])) return

    const rest = Object.fromEntries(Object.entries(catalog).filter(([key]: [string, unknown]): boolean => key !== 'statuses'))
    const migrated: Record<string, unknown> = { ...record }
    if (Object.keys(rest).length > 0) migrated['catalog'] = rest
    else delete migrated['catalog']
    this.files.writeJson(configPath, migrated)
    this.log('config: the status list is the catalog\'s to decide now — removed the one written at setup')
  }
}

function isWrittenStatuses (value: unknown): boolean {
  return Array.isArray(value) && value.length === WRITTEN_STATUSES.length &&
    value.every((status: unknown, index: number): boolean => status === WRITTEN_STATUSES[index])
}
