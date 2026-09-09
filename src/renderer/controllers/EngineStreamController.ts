import type { BridgeApi } from '../../shared/contracts/BridgeApi'
import type { SyncEventDto } from '../../shared/contracts/dto/SyncEventDto'
import type { AppStore } from '../state/AppStore'

/**
 * The engine's own voice: its log, its progress events, and whether it is busy.
 *
 * Subscribed once at boot. The counter is derived from the events rather than
 * guessed: `plan` says how many titles there are, `begin` and `installed` move it. The
 * counter itself lives in the state, not here — this only knows how each event moves it.
 */
export class EngineStreamController {
  public constructor (
    private readonly bridge: BridgeApi,
    private readonly store: AppStore
  ) {}

  public subscribe (): void {
    this.bridge.onLog((line: string): void => { this.store.applyLogLine(line) })
    this.bridge.onBusyChanged((busy: boolean): void => { this.store.applyBusy(busy) })
    this.bridge.onSyncEvent((event: SyncEventDto): void => { this.handleEvent(event) })
  }

  private handleEvent (event: SyncEventDto): void {
    const { messages, progress: current } = this.store.readState()
    switch (event.event) {
      case 'plan':
        this.store.applyProgress({ total: event.count, done: 0, label: `0 ${messages.of} ${String(event.count)}` })
        return
      case 'begin':
        if (current === null) return
        this.store.applyProgress({
          ...current,
          label: `${String(current.done + 1)} ${messages.of} ${String(current.total)} · ${event.title}`
        })
        return
      case 'installed':
        if (current !== null) this.store.applyProgress({ ...current, done: current.done + 1 })
        this.store.applyLogLine(`${event.title} — ${event.changed ? messages.installed : messages.upToDate}`)
        return
      case 'failed':
        this.store.applyLogLine(`${event.name}: ${messages.failed} — ${event.error}`)
        return
      case 'removed':
        this.store.applyLogLine(`${event.name} — ${messages.removed}`)
        return
      case 'pruned':
      case 'finished':
        return
    }
  }
}
