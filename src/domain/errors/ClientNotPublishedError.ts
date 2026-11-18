import { DomainError } from './DomainError'

/** The catalog this client checks for updates does not list it (yet). */
export class ClientNotPublishedError extends DomainError {
  public override readonly code: string = 'CLIENT_NOT_PUBLISHED'

  public constructor (public readonly softwareName: string, public readonly catalogUrl: string) {
    super(`${catalogUrl} does not list ${softwareName}`)
  }
}
