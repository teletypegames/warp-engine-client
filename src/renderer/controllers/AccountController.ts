import { describeError } from '../../domain/errors/DescribeError'
import type { BridgeApi } from '../../shared/contracts/BridgeApi'
import type { SignInFinishedDto } from '../../shared/contracts/dto/AccountDto'
import type { AppStore } from '../state/AppStore'

/**
 * Signing in and out, from the window's side.
 *
 * Two halves that do not meet: `signIn` puts a code on screen and returns, and the
 * answer arrives later on the sign-in stream — because the person is not here while it
 * happens, they are in a browser. Nothing waits on anything.
 *
 * A sign-in that succeeds refreshes the catalog rather than patching the cards, since
 * every entitlement in the listing was read without a credential and is now stale.
 */
export class AccountController {
  public constructor (
    private readonly bridge: BridgeApi,
    private readonly store: AppStore,
    private readonly onSignedIn: () => Promise<void>
  ) {}

  public subscribe (): void {
    this.bridge.onSignInFinished((result: SignInFinishedDto): void => {
      this.store.applySignIn(null)
      this.store.applyAccount(result.account)
      this.store.applyLogLine(this.describeOutcome(result))
      // Only a successful sign-in changes what the catalog would say. The other three
      // leave it exactly as it was, and re-reading it would be a pointless wait.
      if (result.outcome === 'signedIn') void this.onSignedIn()
    })
  }

  /** Sign in when signed out, sign out when signed in: the one account button. */
  public async toggleSignedIn (): Promise<void> {
    if (this.store.readState().account.signedIn) await this.signOut()
    else await this.signIn()
  }

  public async signIn (): Promise<void> {
    try {
      const prompt = await this.bridge.beginSignIn()
      this.store.applySignIn(prompt)
      // Opened for them rather than waiting to be clicked: the browser is where the
      // rest of this happens, and the code on screen is no use until it is open.
      await this.bridge.openUrl(prompt.verificationUrl)
    } catch (error: unknown) {
      this.store.applySignIn(null)
      this.store.applyLogLine(`${this.store.readState().messages.signInFailed} ${describeError(error)}`)
    }
  }

  /** Re-open the page for somebody who closed the tab before typing the code. */
  public async openVerificationPage (): Promise<void> {
    const prompt = this.store.readState().signIn
    if (prompt === null) return

    await this.bridge.openUrl(prompt.verificationUrl)
  }

  public async cancelSignIn (): Promise<void> {
    this.store.applySignIn(null)
    await this.bridge.cancelSignIn()
  }

  public async signOut (): Promise<void> {
    try {
      this.store.applyAccount(await this.bridge.signOut())
      // The listing was read as somebody; it has to be read again as nobody, or every
      // owned title keeps its Install button until the next refresh.
      await this.onSignedIn()
    } catch (error: unknown) {
      this.store.applyLogLine(describeError(error))
    }
  }

  private describeOutcome (result: SignInFinishedDto): string {
    const messages = this.store.readState().messages
    switch (result.outcome) {
      case 'signedIn': return messages.signInDone
      case 'denied': return messages.signInDenied
      case 'expired': return messages.signInExpired
      case 'cancelled': return messages.signInCancelled
    }
  }
}
