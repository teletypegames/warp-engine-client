import { HttpStatusError } from '../http/HttpTextClient'
import type { StoreHttpClient } from '../http/StoreHttpClient'
import type { StoreFileSystem } from '../files/StoreFileSystem'
import { asRecord, readOptionalString, readRecord } from '../json/JsonRecord'

const BUILDS_PATH = '/api/builds'

/** What a catalog calls its platforms, by platform name. */
export class PlatformLabels {
  public constructor (private readonly labels: Readonly<Record<string, string>>) {}

  /** The display name, or the raw name for a platform the catalog did not describe. */
  public labelFor (platform: string): string {
    const label = this.labels[platform]
    return label !== undefined && label.length > 0 ? label : platform
  }
}

const NO_LABELS = new PlatformLabels({})

/**
 * `GET /api/builds`: the catalog's own names for its platforms.
 *
 * The catalog lists a title's platform as a slug — `plus4`, `tic80` — and the same
 * server knows what to call it: the build matrix carries a label per platform. Asking
 * the server rather than keeping a table here is what lets a catalog add a platform
 * without a new client, which is the whole arrangement between the two.
 *
 * Best effort, cached beside the catalog: an old engine without the endpoint, or a
 * machine offline, still shows the slugs, and a label is not worth failing a listing
 * over.
 */
export class PlatformLabelsClient {
  public constructor (
    private readonly http: StoreHttpClient,
    private readonly baseUrl: string,
    private readonly files: StoreFileSystem,
    private readonly cachePath: string,
    private readonly log: (line: string) => void
  ) {}

  public async fetchLabels (): Promise<PlatformLabels> {
    const url = `${this.baseUrl}${BUILDS_PATH}`
    try {
      const { json } = await this.http.requestJson(url)
      const labels = readLabels(json)
      this.files.writeJson(this.cachePath, labels)
      return new PlatformLabels(labels)
    } catch (error: unknown) {
      if (error instanceof HttpStatusError && error.statusCode === 404) {
        this.log('the catalog has no build matrix — platforms keep their slugs')
        return NO_LABELS
      }
      const cached = asRecord(this.files.readJson(this.cachePath))
      if (cached !== null) return new PlatformLabels(readCached(cached))
      this.log(`warning: could not read ${url} — platforms keep their slugs`)
      return NO_LABELS
    }
  }
}

function readLabels (json: unknown): Record<string, string> {
  const record = asRecord(json)
  const platforms = record === null ? null : readRecord(record, 'platforms')
  const labels: Record<string, string> = {}
  if (platforms === null) return labels
  for (const [name, value] of Object.entries(platforms)) {
    const entry = asRecord(value)
    if (entry === null) continue
    const label = readOptionalString(entry, 'label')
    if (label !== null && label.length > 0) labels[name] = label
  }
  return labels
}

function readCached (record: Readonly<Record<string, unknown>>): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const [name, value] of Object.entries(record)) {
    if (typeof value === 'string' && value.length > 0) labels[name] = value
  }
  return labels
}
