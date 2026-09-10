import { checkForUpdate, type ClientUpdateCheck } from '../../domain/models/ClientRelease'
import type { ApplicationEnvironment } from '../../domain/ports/ApplicationEnvironment'
import type { ClientReleaseGateway } from '../../domain/ports/ClientReleaseGateway'

/**
 * Whether a newer client than this one is published.
 *
 * Only a check, on request: the app does not update itself, and it does not ask the
 * feed on its own — a store that phones home at start-up is a different kind of program.
 * What comes back is a version and a page, and opening the page is the person's move.
 */
export class ClientUpdateService {
  public constructor (
    private readonly releases: ClientReleaseGateway,
    private readonly environment: ApplicationEnvironment
  ) {}

  public async checkForUpdates (): Promise<ClientUpdateCheck> {
    return checkForUpdate(this.environment.readVersion(), await this.releases.readLatestRelease())
  }
}
