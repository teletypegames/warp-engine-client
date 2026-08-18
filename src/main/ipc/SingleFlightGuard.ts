import { BusyError } from '../../domain/errors/BusyError'

/**
 * One engine call at a time.
 *
 * The store writes files, and two writers would race. Callers are told which state
 * the guard is in, so the window can disable exactly what would start a second
 * call and leave the rest alive.
 */
export class SingleFlightGuard {
  private running = false

  public constructor (private readonly onBusyChanged: (busy: boolean) => void) {}

  public get busy (): boolean {
    return this.running
  }

  public async run<TResult>(task: () => Promise<TResult>): Promise<TResult> {
    if (this.running) throw new BusyError()
    this.running = true
    this.onBusyChanged(true)
    try {
      return await task()
    } finally {
      this.running = false
      this.onBusyChanged(false)
    }
  }
}
