import { DomainError } from './DomainError'

export class PythonMissingError extends DomainError {
  public override readonly code: string = 'PYTHON_MISSING'

  public constructor () {
    super('python3 was not found on this machine')
  }
}
