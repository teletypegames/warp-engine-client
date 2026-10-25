import { HttpStatusError } from '../http/HttpStatusError'
import type { StoreHttpClient } from '../http/StoreHttpClient'
import type { StoreFileSystem } from '../files/StoreFileSystem'
import { asRecord, readOptionalString, type JsonRecord } from '../json/JsonRecord'
import { CatalogVocabulary, NO_VOCABULARY } from './CatalogVocabulary'

const VOCABULARY_PATH = '/api/software/vocabulary'

/**
 * `GET /api/software/vocabulary`, cached beside the store like the platform labels.
 *
 * A 404 is an older engine and not an error: the words stay as they are. Any other
 * failure falls back to the cached copy, then to no vocabulary at all — a filter chip
 * that says `puzzle` instead of *Puzzle* is not worth failing a listing over, and the
 * statuses then fall back to released and archived.
 *
 * The cache holds the response as it came, so the copy read offline is read by the same
 * code. A cache written before 3.2.0 is the bare category labels, and still reads.
 */
export class VocabularyClient {
  public constructor (
    private readonly http: StoreHttpClient,
    private readonly baseUrl: string,
    private readonly files: StoreFileSystem,
    private readonly cachePath: string,
    private readonly log: (line: string) => void
  ) {}

  public async fetchVocabulary (): Promise<CatalogVocabulary> {
    const url = `${this.baseUrl}${VOCABULARY_PATH}`
    try {
      const { json } = await this.http.requestJson(url)
      const vocabulary = readVocabulary(json)
      this.files.writeJson(this.cachePath, json)
      return vocabulary
    } catch (error: unknown) {
      if (error instanceof HttpStatusError && error.statusCode === 404) {
        this.log('the catalog has no vocabulary — categories keep their keys')
        return NO_VOCABULARY
      }
      const cached = asRecord(this.files.readJson(this.cachePath))
      if (cached !== null) return readCached(cached)
      this.log(`warning: could not read ${url} — categories keep their keys`)
      return NO_VOCABULARY
    }
  }
}

function readVocabulary (json: unknown): CatalogVocabulary {
  const record = asRecord(json)
  if (record === null) return NO_VOCABULARY
  return new CatalogVocabulary(readCategories(record), readVisibleStatuses(record))
}

function readCategories (record: JsonRecord): Record<string, string> {
  const labels: Record<string, string> = {}
  const categories: unknown = record['categories']
  if (!Array.isArray(categories)) return labels
  for (const item of categories) {
    const entry = asRecord(item)
    if (entry === null) continue
    const key = readOptionalString(entry, 'key')
    const label = readOptionalString(entry, 'label')
    if (key !== null && key.length > 0 && label !== null && label.length > 0) labels[key] = label
  }
  return labels
}

/**
 * Null when the vocabulary marks no status visible: an empty list would mean "every
 * status" to the surveyor, the opposite of what such a catalog says.
 */
function readVisibleStatuses (record: JsonRecord): readonly string[] | null {
  const statuses: unknown = record['statuses']
  if (!Array.isArray(statuses) || statuses.length === 0) return null
  const visible: string[] = []
  for (const item of statuses) {
    const entry = asRecord(item)
    if (entry?.['defaultVisible'] !== true) continue
    const key = readOptionalString(entry, 'key')
    if (key !== null && key.length > 0) visible.push(key)
  }
  return visible.length > 0 ? visible : null
}

function readCached (record: JsonRecord): CatalogVocabulary {
  if (Array.isArray(record['categories']) || Array.isArray(record['statuses'])) return readVocabulary(record)
  const labels: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string' && value.length > 0) labels[key] = value
  }
  return new CatalogVocabulary(labels)
}
