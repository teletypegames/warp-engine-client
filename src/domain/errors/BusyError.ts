import { DomainError } from './DomainError'

/** A second engine call while one is running. The store writes files; two writers race. */
export class BusyError extends DomainError {
  public override readonly code: string = 'BUSY'

  public constructor () {
    super('the store is busy with another operation')
  }
}
