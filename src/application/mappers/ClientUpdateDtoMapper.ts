import type { ClientUpdateCheck } from '../../domain/models/ClientRelease'
import type { ClientUpdateDto } from '../../shared/contracts/dto/ClientUpdateDto'

/** The check, restated for the bridge: the same four facts, nothing the window could misuse. */
export class ClientUpdateDtoMapper {
  public toDto (check: ClientUpdateCheck): ClientUpdateDto {
    return {
      currentVersion: check.currentVersion,
      latestVersion: check.latestVersion,
      releaseUrl: check.releaseUrl,
      updateAvailable: check.updateAvailable
    }
  }
}
