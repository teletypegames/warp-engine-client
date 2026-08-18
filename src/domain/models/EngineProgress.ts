import type { SyncEventDto } from '../../shared/contracts/dto/SyncEventDto'

/**
 * How a long-running engine call reports itself.
 *
 * `onLog` is a line a person can read (the engine's stderr), `onEvent` one of its
 * JSON progress events. Both are optional: a caller that only wants the result
 * passes neither.
 */
export interface EngineProgressListener {
  readonly onLog?: (line: string) => void
  readonly onEvent?: (event: SyncEventDto) => void
}
