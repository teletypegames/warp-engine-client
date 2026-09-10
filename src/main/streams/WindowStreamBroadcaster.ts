import type { BrowserWindow } from 'electron'
import type { EngineProgressListener } from '../../domain/models/EngineProgress'
import { IPC_CHANNELS } from '../../shared/contracts/IpcChannels'
import type { SignInFinishedDto } from '../../shared/contracts/dto/AccountDto'
import type { CatalogPageDto } from '../../shared/contracts/dto/CatalogPageDto'
import type { SyncEventDto } from '../../shared/contracts/dto/SyncEventDto'

/**
 * The one-way streams to the window: log lines, progress events, busy state, and how a
 * sign-in ended.
 *
 * Holds no window of its own — the reference is handed in when one exists and
 * cleared when it does not, so a stream that outlives the window is a no-op rather
 * than a crash.
 */
export class WindowStreamBroadcaster {
  private window: BrowserWindow | null = null

  public attachWindow (window: BrowserWindow): void {
    this.window = window
  }

  public detachWindow (): void {
    this.window = null
  }

  public publishLog (line: string): void {
    this.send(IPC_CHANNELS.streamLog, line)
  }

  public publishSyncEvent (event: SyncEventDto): void {
    this.send(IPC_CHANNELS.streamSyncEvent, event)
  }

  public publishCatalogPage (page: CatalogPageDto): void {
    this.send(IPC_CHANNELS.streamCatalogPage, page)
  }

  public publishBusyChanged (busy: boolean): void {
    this.send(IPC_CHANNELS.streamBusyChanged, busy)
  }

  /**
   * A sign-in finishes minutes after the call that started it returned, and in another
   * window entirely — so it arrives as an event rather than as a reply.
   */
  public publishSignInFinished (result: SignInFinishedDto): void {
    this.send(IPC_CHANNELS.streamSignInFinished, result)
  }

  /** A progress listener wired to these streams, for handing to the engine. */
  public asProgressListener (): EngineProgressListener {
    return {
      onLog: (line: string): void => { this.publishLog(line) },
      onEvent: (event: SyncEventDto): void => { this.publishSyncEvent(event) }
    }
  }

  private send (channel: string, payload: unknown): void {
    const window = this.window
    if (window === null || window.isDestroyed()) return
    window.webContents.send(channel, payload)
  }
}
