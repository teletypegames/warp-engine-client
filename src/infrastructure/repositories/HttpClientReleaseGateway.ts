import type { ClientRelease } from '../../domain/models/ClientRelease'
import type { ClientReleaseGateway } from '../../domain/ports/ClientReleaseGateway'
import type { BuildConfiguration } from '../config/BuildConfiguration'
import type { HttpTextClient } from '../http/HttpTextClient'
import { asRecord, readString } from '../json/JsonRecord'

/** The repository this client is released from, on the forge's API. */
const DEFAULT_RELEASES_API_URL =
  'https://git.teletypegames.org/api/v1/repos/stores/warp-engine-client/releases/latest'

/**
 * The newest release, from a Gitea/Forgejo release list.
 *
 * `releases/latest` is the forge's own answer to "newest published, not draft, not
 * pre-release", so nothing is sorted here. Two fields are read — the tag and the page —
 * and the tag's `v` is dropped so it compares with the version `package.json` carries.
 * A build for another forge sets `warpEngine.releasesUrl` in its `package.json`.
 */
export class HttpClientReleaseGateway implements ClientReleaseGateway {
  public readonly sourceUrl: string

  public constructor (
    private readonly httpClient: HttpTextClient,
    buildConfiguration: BuildConfiguration
  ) {
    this.sourceUrl = buildConfiguration.readReleasesApiUrl() ?? DEFAULT_RELEASES_API_URL
  }

  public async readLatestRelease (): Promise<ClientRelease> {
    const record = asRecord(JSON.parse(await this.httpClient.readText(this.sourceUrl)))
    if (record === null) throw new Error(`${this.sourceUrl} did not answer with a release`)
    const tag = readString(record, 'tag_name').trim()
    if (tag.length === 0) throw new Error(`${this.sourceUrl} answered with a release that has no tag`)
    return {
      version: tag.replace(/^v/i, ''),
      url: readString(record, 'html_url').trim()
    }
  }
}
