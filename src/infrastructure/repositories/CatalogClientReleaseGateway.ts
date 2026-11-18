import { ClientNotPublishedError } from '../../domain/errors/ClientNotPublishedError'
import type { ClientIdentity } from '../../domain/models/ClientIdentity'
import type { ClientRelease } from '../../domain/models/ClientRelease'
import type { ClientReleaseGateway } from '../../domain/ports/ClientReleaseGateway'
import type { HttpTextClient } from '../http/HttpTextClient'
import { asRecord, readString, type JsonRecord } from '../json/JsonRecord'

/** The asset kind a release carries for each machine this client is packaged for. */
const KIND_BY_MACHINE: Readonly<Record<string, string>> = {
  'linux-x64': 'linux_x64',
  'win32-x64': 'win_x64',
  'darwin-arm64': 'mac_arm64',
  'darwin-x64': 'mac_x64'
}

/**
 * The newest release of this client, from the catalog it is published in.
 *
 * The client is a title of the `electron` platform, so its releases are the catalog's:
 * `GET /api/software?q=<name>` and the entry whose `software.name` is exactly that name. The page it points
 * at is the download for this machine when the release has one, else the catalog.
 */
export class CatalogClientReleaseGateway implements ClientReleaseGateway {
  public readonly sourceUrl: string

  public constructor (
    private readonly httpClient: HttpTextClient,
    private readonly identity: ClientIdentity
  ) {
    const base = identity.catalogUrl.replace(/\/+$/, '')
    this.sourceUrl = `${base}/api/software?q=${encodeURIComponent(identity.name)}&per_page=50`
  }

  public async readLatestRelease (): Promise<ClientRelease> {
    const envelope = asRecord(JSON.parse(await this.httpClient.readText(this.sourceUrl)))
    const entries: readonly unknown[] = Array.isArray(envelope?.['softwares']) ? envelope['softwares'] : []
    const entry = entries
      .map((row: unknown): JsonRecord | null => asRecord(row))
      .find((row: JsonRecord | null): boolean => row !== null && this.isOwnEntry(row))
    const release = entry === undefined || entry === null ? null : asRecord(entry['latestRelease'])
    const version = release === null ? '' : readString(release, 'version').trim()
    if (release === null || version.length === 0) {
      throw new ClientNotPublishedError(this.identity.name, this.identity.catalogUrl)
    }
    return { version, url: this.downloadUrl(release) }
  }

  /** A catalog entry carries the title under `software`; its `name` is what identifies it. */
  private isOwnEntry (row: JsonRecord): boolean {
    const software = asRecord(row['software'])
    return software !== null && readString(software, 'name') === this.identity.name
  }

  private downloadUrl (release: JsonRecord): string {
    const base = this.identity.catalogUrl.replace(/\/+$/, '')
    const kind = KIND_BY_MACHINE[`${process.platform}-${process.arch}`]
    const assets: readonly unknown[] = Array.isArray(release['assets']) ? release['assets'] : []
    const asset = assets
      .map((row: unknown): JsonRecord | null => asRecord(row))
      .find((row: JsonRecord | null): boolean => row !== null && readString(row, 'kind') === kind)
    const path = asset === undefined || asset === null ? '' : readString(asset, 'path')
    return path.length > 0 ? `${base}${path}` : base
  }
}

/** The gateway of a build that names no catalog of its own: every check says so. */
export class UnpublishedClientReleaseGateway implements ClientReleaseGateway {
  public readonly sourceUrl: string = ''

  public async readLatestRelease (): Promise<ClientRelease> {
    return Promise.reject(new ClientNotPublishedError('this client', 'no catalog'))
  }
}
