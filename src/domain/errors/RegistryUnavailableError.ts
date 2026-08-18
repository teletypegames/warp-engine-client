import { DomainError } from './DomainError'

export class RegistryUnavailableError extends DomainError {
  public override readonly code: string = 'REGISTRY_UNAVAILABLE'

  public constructor (public readonly sourceUrl: string, reason: string) {
    super(`${sourceUrl}: ${reason}`)
  }
}
