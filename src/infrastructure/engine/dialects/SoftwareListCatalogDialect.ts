import type { SupportedWarpEngineVersion } from '../../../domain/models/WarpEngineVersion'
import {
  asRecord, readOptionalString, readRecord, readString, type JsonRecord
} from '../../json/JsonRecord'
import type { CatalogAccess } from '../../../domain/models/CatalogAccess'
import type {
  CatalogAsset, CatalogDialect, CatalogEntry, CatalogRelease, CatalogSoftware
} from './CatalogDialect'

/**
 * The catalog as every WarpEngine from 0.2 to 0.4 serves it.
 *
 * `{ softwares: [ { software: {…}, latestRelease: {…}, releases: [ { assets: [] } ] } ] }`,
 * camelCase throughout. The three versions differ in what they *contain* — 0.3 added
 * the `linux_arm64` asset kinds, so an older engine simply has fewer kinds to offer,
 * and that needs no code: an absent kind is a title reported as unavailable on this
 * machine, which is already the honest answer.
 *
 * The version is carried rather than assumed, so a log line can name which dialect read
 * a catalog even while one class serves several.
 */
export class SoftwareListCatalogDialect implements CatalogDialect {
  public constructor (public readonly version: SupportedWarpEngineVersion) {}

  public listEntries (catalog: unknown): readonly CatalogEntry[] {
    const record = asRecord(catalog)
    if (record === null) return []
    const entries = record['softwares']
    if (!Array.isArray(entries)) return []

    const found: CatalogEntry[] = []
    for (const item of entries) {
      const entry = asRecord(item)
      if (entry === null) continue
      const software = this.readSoftware(entry)
      if (software === null) continue
      found.push({
        software,
        access: this.readAccess(entry),
        latestRelease: this.readLatestRelease(entry),
        releaseCandidates: this.readCandidates(entry)
      })
    }
    return found
  }

  /**
   * What the catalog says about getting this title. Nothing, at these versions.
   *
   * An engine older than 0.5 has no opinion to report, and inventing one here would be
   * worse than admitting it: "not gated" and "could not say" are different answers, and
   * only the first is safe to act on. The subclass that can read it overrides this.
   */
  protected readAccess (entry: JsonRecord): CatalogAccess | null {
    void entry
    return null
  }

  /** A title with no name is not a title: nothing could be keyed by it. */
  protected readSoftware (entry: JsonRecord): CatalogSoftware | null {
    const software = readRecord(entry, 'software')
    if (software === null) return null
    const name = readOptionalString(software, 'name')
    if (name === null) return null
    return {
      name,
      title: readOptionalString(software, 'title') ?? name,
      platform: readString(software, 'platform'),
      status: readString(software, 'status'),
      description: readString(software, 'desc').trim(),
      author: readString(software, 'author').trim(),
      imageUrl: readOptionalString(software, 'imageUrl')
    }
  }

  protected readLatestRelease (entry: JsonRecord): CatalogRelease | null {
    const latest = readRecord(entry, 'latestRelease')
    return latest === null ? null : this.readRelease(latest)
  }

  /**
   * The releases to try, newest first and without repeats.
   *
   * `releases` arrives newest-first from the API and `latestRelease` is usually its
   * first element, so identity is settled on the release's own id where it has one.
   */
  protected readCandidates (entry: JsonRecord): readonly CatalogRelease[] {
    const records: JsonRecord[] = []
    const latest = readRecord(entry, 'latestRelease')
    if (latest !== null) records.push(latest)
    const releases = entry['releases']
    if (Array.isArray(releases)) {
      for (const item of releases) {
        const record = asRecord(item)
        if (record !== null) records.push(record)
      }
    }

    const seen = new Set<string>()
    const candidates: CatalogRelease[] = []
    for (const record of records) {
      const identity = JSON.stringify(record['id'] ?? null)
      if (seen.has(identity)) continue
      seen.add(identity)
      candidates.push(this.readRelease(record))
    }
    return candidates
  }

  protected readRelease (release: JsonRecord): CatalogRelease {
    const assets: CatalogAsset[] = []
    const listed = release['assets']
    if (Array.isArray(listed)) {
      for (const item of listed) {
        const asset = asRecord(item)
        if (asset === null) continue
        assets.push({ kind: readString(asset, 'kind'), path: readString(asset, 'path') })
      }
    }
    return {
      version: readString(release, 'version'),
      createdAt: readOptionalString(release, 'createdAt'),
      assets
    }
  }
}
