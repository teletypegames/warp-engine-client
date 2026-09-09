import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { DomainError } from '../../domain/errors/DomainError'
import type { IpcChannel } from '../../shared/contracts/IpcChannels'

/** What a channel does with the arguments it was invoked with. */
export type IpcHandler<TResult> = (...args: readonly unknown[]) => Promise<TResult> | TResult

/**
 * The one place a channel is registered.
 *
 * Errors are normalised on the way out: a domain error crosses as `CODE: message`
 * so the log drawer shows something a person can act on, and an unexpected one is
 * logged here rather than vanishing into a rejected promise the window cannot read.
 */
export class IpcRouter {
  public constructor (private readonly ipc: IpcMain) {}

  public handle<TResult>(channel: IpcChannel, handler: IpcHandler<TResult>): void {
    this.ipc.handle(channel, async (_event: IpcMainInvokeEvent, ...args: readonly unknown[]): Promise<TResult> => {
      try {
        return await handler(...args)
      } catch (error: unknown) {
        throw this.toIpcError(channel, error)
      }
    })
  }

  /** The error as it crosses the bridge: a domain error by its code, anything else logged here. */
  private toIpcError (channel: IpcChannel, error: unknown): Error {
    if (error instanceof DomainError) return new Error(`${error.code}: ${error.message}`)
    if (error instanceof Error) {
      console.error(`[ipc] ${channel} failed: ${error.message}`)
      return error
    }
    console.error(`[ipc] ${channel} failed: ${String(error)}`)
    return new Error(String(error))
  }
}
