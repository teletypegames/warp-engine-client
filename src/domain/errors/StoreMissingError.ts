import { DomainError } from './DomainError'

export class StoreMissingError extends DomainError {
  public override readonly code: string = 'STORE_MISSING'

  public constructor (home?: string) {
    super(home === undefined ? 'no store is installed yet' : `no store at ${home}`)
  }
}
