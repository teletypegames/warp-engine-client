import type { HostSpecific } from '../../domain/models/HostMachine'
import {
  APP_MODE, DEFAULT_STORE_CONFIGURATION, WEB_MODE,
  type AssetSpecification, type BehaviorConfiguration, type CatalogConfiguration,
  type InstallConfiguration, type PathsConfiguration, type PlatformConfiguration,
  type StoreConfiguration, type StoreDescriptor
} from '../../domain/models/StoreConfiguration'
import {
  asRecord, readBoolean, readNumber, readOptionalString, readRecord, readString,
  readStringArray, type JsonRecord
} from '../json/JsonRecord'
import type { StoreFileSystem } from '../files/StoreFileSystem'

/**
 * A store's `config.json`, read onto the defaults.
 *
 * The file is **snake_case** and this is the only place that knows it: that is the
 * format the store repositories publish, and it stays the format on disk so a store
 * config written for the shell engine is still a valid config here. Rename a field
 * there and this reader is the single file that follows.
 *
 * Reading replaces the deep merge the shell engine did: every field states its own
 * default, so a config that omits a section gets the whole section rather than a
 * half-populated one.
 */
export class StoreConfigurationReader {
  public constructor (private readonly files: StoreFileSystem) {}

  public readConfiguration (configPath: string): StoreConfiguration {
    const record = asRecord(this.files.readJson(configPath)) ?? {}
    return {
      store: readStore(readRecord(record, 'store') ?? {}),
      paths: readPaths(readRecord(record, 'paths') ?? {}),
      install: readInstall(readRecord(record, 'install') ?? {}),
      catalog: readCatalog(readRecord(record, 'catalog') ?? {}),
      platforms: readPlatforms(readRecord(record, 'platforms')),
      behavior: readBehavior(readRecord(record, 'behavior') ?? {})
    }
  }
}

function readStore (record: JsonRecord): StoreDescriptor {
  const defaults = DEFAULT_STORE_CONFIGURATION.store
  const api = readRecord(record, 'api') ?? {}
  return {
    id: readString(record, 'id', defaults.id),
    name: readString(record, 'name', defaults.name),
    // Trailing slashes are stripped once, here, so every URL built from it joins
    // with exactly one separator.
    baseUrl: readString(record, 'base_url', defaults.baseUrl).replace(/\/+$/, ''),
    api: {
      catalog: readString(api, 'catalog', defaults.api.catalog),
      download: readString(api, 'download', defaults.api.download)
    }
  }
}

function readPaths (record: JsonRecord): PathsConfiguration {
  const defaults = DEFAULT_STORE_CONFIGURATION.paths
  return {
    installRoot: readOptionalString(record, 'install_root'),
    menuDirectory: readOptionalString(record, 'menu_dir'),
    iconDirectory: readOptionalString(record, 'icon_dir'),
    subfolder: readString(record, 'subfolder', defaults.subfolder)
  }
}

function readInstall (record: JsonRecord): InstallConfiguration {
  const defaults = DEFAULT_STORE_CONFIGURATION.install
  const modes = readStringArray(record, 'modes')
  const specifications: Record<string, AssetSpecification> = {}

  for (const [key, value] of Object.entries(record)) {
    if (key === 'modes') continue
    const specification = asRecord(value)
    if (specification === null) continue
    specifications[key] = {
      kind: readAssetKind(specification['kind']),
      extension: readHostSpecificString(specification['ext'])
    }
  }
  for (const mode of [APP_MODE, WEB_MODE]) {
    specifications[mode] ??= defaults.specifications[mode] ?? { kind: null, extension: null }
  }

  return { modes: modes.length > 0 ? modes : defaults.modes, specifications }
}

function readCatalog (record: JsonRecord): CatalogConfiguration {
  const defaults = DEFAULT_STORE_CONFIGURATION.catalog
  const statuses = readStringArray(record, 'statuses')
  const ownerId = record['owner_id']
  return {
    // An explicit empty list means "every status", so only a missing key falls back.
    statuses: record['statuses'] === undefined ? defaults.statuses : statuses,
    ownerId: typeof ownerId === 'number' && Number.isFinite(ownerId) ? ownerId : null,
    only: readStringArray(record, 'only'),
    exclude: readStringArray(record, 'exclude')
  }
}

function readPlatforms (record: JsonRecord | null): Readonly<Record<string, PlatformConfiguration>> {
  if (record === null) return DEFAULT_STORE_CONFIGURATION.platforms
  const platforms: Record<string, PlatformConfiguration> = {}
  for (const [name, value] of Object.entries(record)) {
    const entry = asRecord(value)
    platforms[name] = { enabled: entry === null ? true : readBoolean(entry, 'enabled', true) }
  }
  return platforms
}

function readBehavior (record: JsonRecord): BehaviorConfiguration {
  const defaults = DEFAULT_STORE_CONFIGURATION.behavior
  return {
    prune: readBoolean(record, 'prune', defaults.prune),
    timeout: readNumber(record, 'timeout', defaults.timeout),
    insecure: readBoolean(record, 'insecure', defaults.insecure)
  }
}

/** `"linux_x64"`, `["win_x64", "win_x86"]`, or either of those keyed by host. */
function readAssetKind (value: unknown): HostSpecific<string | readonly string[]> | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return readStrings(value)
  const record = asRecord(value)
  if (record === null) return null
  const map: Record<string, string | readonly string[]> = {}
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === 'string') map[key] = entry
    else if (Array.isArray(entry)) map[key] = readStrings(entry)
  }
  return map
}

function readHostSpecificString (value: unknown): HostSpecific<string> | null {
  if (typeof value === 'string') return value
  const record = asRecord(value)
  if (record === null) return null
  const map: Record<string, string> = {}
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === 'string') map[key] = entry
  }
  return map
}

function readStrings (values: readonly unknown[]): readonly string[] {
  return values.filter((item: unknown): item is string => typeof item === 'string')
}
