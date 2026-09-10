import type { ClientRelease } from '../models/ClientRelease'

/**
 * Where this client's own releases are published.
 *
 * A gateway because the feed has a protocol of its own — today a Gitea release list —
 * and the application only wants one answer from it: the newest version, and where it is.
 */
export interface ClientReleaseGateway {
  readLatestRelease: () => Promise<ClientRelease>
}
