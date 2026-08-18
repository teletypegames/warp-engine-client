import type { BridgeApi } from '../../shared/contracts/BridgeApi'
import type { SyncEventDto } from '../../shared/contracts/dto/SyncEventDto'
import type { AppStore, SyncProgress } from '../state/AppStore'
import type { LogDrawerView } from '../views/LogDrawerView'

/**
 * The engine's own voice: its log, its progress events, and whether it is busy.
 *
 * Subscribed once at boot. The counter is derived from the events rather than
 * guessed: `plan` says how many titles there are, `begin` and `installed` move it.
 */
export class EngineStreamController {
  private progress: SyncProgress | null = null

  public constructor (
    private readonly bridge: BridgeApi,
    private readonly store: AppStore,
    private readonly log: LogDrawerView
  ) {}

  public subscribe (): void {
    this.bridge.onLog((line: string): void => { this.log.appendLine(line) })
    this.bridge.onBusyChanged((busy: boolean): void => {
      if (!busy) this.progress = null
      this.store.applyBusy(busy)
    })
    this.bridge.onSyncEvent((event: SyncEventDto): void => { this.handleEvent(event) })
  }

  private handleEvent (event: SyncEventDto): void {
    const messages = this.store.readState().messages
    switch (event.event) {
      case 'plan':
        this.progress = { total: event.count, done: 0, label: `0 ${messages.of} ${String(event.count)}` }
        this.store.applyProgress(this.progress)
        return
      case 'begin': {
        const current = this.progress
        if (current === null) return
        this.progress = {
          ...current,
          label: `${String(current.done + 1)} ${messages.of} ${String(current.total)} · ${event.title}`
        }
        this.store.applyProgress(this.progress)
        return
      }
      case 'installed': {
        const current = this.progress
        if (current !== null) {
          this.progress = { ...current, done: current.done + 1 }
          this.store.applyProgress(this.progress)
        }
        this.log.appendLine(`${event.title} — ${event.changed ? messages.installed : messages.upToDate}`)
        return
      }
      case 'failed':
        this.log.appendLine(`${event.name}: ${messages.failed} — ${event.error}`)
        return
      case 'removed':
        this.log.appendLine(`${event.name} — ${messages.removed}`)
        return
      case 'pruned':
      case 'finished':
        return
    }
  }
}
