import { DomainError } from './DomainError'

/** The engine ran and failed: a non-zero exit, or a process that never started. */
export class EngineInvocationError extends DomainError {
  public override readonly code: string = 'ENGINE_FAILED'

  public constructor (message: string, public readonly exitCode: number | null = null) {
    super(message)
  }
}
