import {
  gameKey, recordScope, type InstalledRecord
} from '../../domain/models/InstalledRecord'
import {
  asRecord, readOptionalString, readString, type JsonRecord
} from '../json/JsonRecord'
import type { StoreFileSystem } from '../files/StoreFileSystem'

/** Bumped when the on-disk shape changes. v1 keyed `installed` by bare software name. */
const STATE_VERSION = 2

/**
 * `state.json`: what this store put on this machine, and where.
 *
 * The file is **snake_case**, and deliberately so: it is the same file the shell
 * store engine wrote, so a machine that installed games through the CLI keeps its
 * library when the client takes over. This class is the only place that knows the
 * on-disk field names — everything above it sees `InstalledRecord`.
 *
 * A `version: 1` file, keyed by bare software name, is re-keyed on first read.
 */
export class StoreStateRepository {
  public constructor (
    private readonly files: StoreFileSystem,
    private readonly statePath: string,
    private readonly log: (line: string) => void
  ) {}

  public readState (): Map<string, InstalledRecord> {
    const state = asRecord(this.files.readJson(this.statePath))
    if (state === null) return new Map<string, InstalledRecord>()
    const installed = asRecord(state['installed'])
    if (installed === null) return new Map<string, InstalledRecord>()

    const version = state['version']
    if (version === 1) return this.migrateFromVersionOne(installed)
    if (version !== STATE_VERSION) return new Map<string, InstalledRecord>()

    const records = new Map<string, InstalledRecord>()
    for (const [key, value] of Object.entries(installed)) {
      const record = asRecord(value)
      if (record !== null) records.set(key, toRecord(record))
    }
    return records
  }

  public writeState (installed: ReadonlyMap<string, InstalledRecord>): void {
    const serialised: Record<string, JsonRecord> = {}
    for (const [key, record] of installed) serialised[key] = fromRecord(record)
    this.files.writeJson(this.statePath, { version: STATE_VERSION, installed: serialised })
  }

  private migrateFromVersionOne (installed: JsonRecord): Map<string, InstalledRecord> {
    const records = new Map<string, InstalledRecord>()
    for (const value of Object.values(installed)) {
      const raw = asRecord(value)
      if (raw === null) continue
      const record = toRecord(raw)
      if (record.name.length > 0 && record.scope.length > 0) records.set(gameKey(record), record)
    }
    this.log(`migrated ${String(records.size)} state entries to the per-scope key format`)
    return records
  }
}

function toRecord (raw: JsonRecord): InstalledRecord {
  return {
    name: readString(raw, 'name'),
    // `system` is what the Batocera store wrote before the shared core existed, and
    // there the two were the same string — so an installed machine needs no migration.
    scope: recordScope(readOptionalString(raw, 'scope'), readOptionalString(raw, 'system')),
    platform: readString(raw, 'platform'),
    kind: readString(raw, 'kind'),
    version: readString(raw, 'version'),
    asset: readString(raw, 'asset'),
    assetPath: readString(raw, 'asset_path'),
    title: readString(raw, 'title'),
    description: readString(raw, 'desc'),
    author: readString(raw, 'author'),
    imageUrl: readOptionalString(raw, 'image_url'),
    createdAt: readOptionalString(raw, 'created_at'),
    mode: readString(raw, 'mode'),
    payload: readOptionalString(raw, 'payload'),
    executable: readOptionalString(raw, 'exe'),
    executableKind: readOptionalString(raw, 'exe_kind'),
    icon: readOptionalString(raw, 'icon'),
    menuEntry: readOptionalString(raw, 'menu'),
    url: readOptionalString(raw, 'url')
  }
}

function fromRecord (record: InstalledRecord): JsonRecord {
  return {
    name: record.name,
    scope: record.scope,
    platform: record.platform,
    kind: record.kind,
    version: record.version,
    asset: record.asset,
    asset_path: record.assetPath,
    title: record.title,
    desc: record.description,
    author: record.author,
    image_url: record.imageUrl,
    created_at: record.createdAt,
    mode: record.mode,
    payload: record.payload,
    exe: record.executable,
    exe_kind: record.executableKind,
    icon: record.icon,
    menu: record.menuEntry,
    url: record.url
  }
}
