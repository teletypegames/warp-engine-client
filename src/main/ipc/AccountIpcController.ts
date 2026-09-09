import os from 'node:os'
import type { AccountDtoMapper } from '../../application/mappers/AccountDtoMapper'
import type { AccountService, SignInResult } from '../../application/services/AccountService'
import { describeError } from '../../domain/errors/DescribeError'
import { IPC_CHANNELS } from '../../shared/contracts/IpcChannels'
import type { AccountDto, SignInPromptDto } from '../../shared/contracts/dto/AccountDto'
import type { WindowStreamBroadcaster } from '../streams/WindowStreamBroadcaster'
import type { IpcRouter } from './IpcRouter'

/**
 * Signing in and out.
 *
 * Deliberately outside the single-flight guard: signing in takes as long as somebody
 * takes to find their browser, and holding the store busy for that would stop them
 * doing anything else meanwhile. Nothing here writes to the library.
 *
 * `beginSignIn` answers with the code as soon as there is one and lets the waiting run
 * on; the end arrives on the sign-in stream. A reply that only came back minutes later
 * would be a request the window had to keep alive for no reason.
 */
export class AccountIpcController {
  public constructor (
    private readonly accounts: AccountService,
    private readonly streams: WindowStreamBroadcaster,
    private readonly accountMapper: AccountDtoMapper
  ) {}

  public register (router: IpcRouter): void {
    router.handle(IPC_CHANNELS.accountRead, async (): Promise<AccountDto> =>
      this.accountMapper.toDto(await this.accounts.readAccount()))
    router.handle(IPC_CHANNELS.accountBeginSignIn, async (): Promise<SignInPromptDto> =>
      this.handleBeginSignIn())
    router.handle(IPC_CHANNELS.accountCancelSignIn, (): Promise<void> => {
      this.accounts.cancelSignIn()
      return Promise.resolve()
    })
    router.handle(IPC_CHANNELS.accountSignOut, async (): Promise<AccountDto> =>
      this.accountMapper.toDto(await this.accounts.signOut()))
  }

  private async handleBeginSignIn (): Promise<SignInPromptDto> {
    const session = await this.accounts.beginSignIn(clientName())

    session.finished.then((result: SignInResult): void => {
      this.streams.publishSignInFinished({
        outcome: result.outcome, account: this.accountMapper.toDto(result.account)
      })
    }, (error: unknown): void => {
      // A sign-in that fell over is a sign-in that did not happen; the window needs to
      // stop showing a code either way.
      this.streams.publishSignInFinished({
        outcome: 'expired', account: { signInAvailable: true, signedIn: false }
      })
      this.streams.publishLog(`sign-in failed: ${describeError(error)}`)
    })

    return {
      userCode: session.prompt.userCode,
      verificationUrl: session.prompt.verificationUrl,
      expiresInSeconds: session.prompt.expiresInSeconds
    }
  }
}

/**
 * What this device calls itself on the person's account page.
 *
 * The machine's own name, because that is what somebody looking at a list of signed-in
 * devices needs in order to recognise which one to remove.
 */
function clientName (): string {
  const hostname = os.hostname()
  return hostname.length > 0 ? `WarpEngine Client (${hostname})` : 'WarpEngine Client'
}
