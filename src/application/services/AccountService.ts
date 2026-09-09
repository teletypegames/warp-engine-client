import {
  NO_ACCOUNT, type SignInOutcome, type SignInPrompt, type StoreAccount
} from '../../domain/models/StoreAccount'
import type { StoreCatalogGateway } from '../../domain/ports/StoreCatalogGateway'
import type { StoreSelectionService } from './StoreSelectionService'

/** A sign-in that is under way: what to show, and how it ended. */
export interface SignInSession {
  readonly prompt: SignInPrompt
  readonly finished: Promise<SignInResult>
}

export interface SignInResult {
  readonly outcome: SignInOutcome
  readonly account: StoreAccount
}

/**
 * Signing in to the store that is open, and out of it again.
 *
 * The waiting lives here rather than in the gateway because it is orchestration: a loop
 * with a cancel and a deadline in it, over a port that only knows how to ask once. That
 * split is also what keeps the port testable without a clock.
 *
 * One sign-in at a time, per application rather than per store: a second one started
 * while the first is waiting would leave two loops racing to write the same token, and
 * a person can only be at one browser tab anyway.
 */
export class AccountService {
  private cancelled = false
  private active: SignInSession | null = null

  public constructor (
    private readonly catalogGateway: StoreCatalogGateway,
    private readonly selection: StoreSelectionService
  ) {}

  /** Null where no store is open — the window asks before anything is chosen. */
  public async readAccount (): Promise<StoreAccount> {
    const store = this.selection.readCurrentStore()
    if (store === null) return NO_ACCOUNT

    return await this.catalogGateway.readAccount(store)
  }

  /**
   * Ask the store for a code, then keep polling until somebody answers.
   *
   * Returns as soon as there is something to show: the code has to be on screen while
   * the polling happens, and a person cannot answer a code they have not seen yet.
   */
  public async beginSignIn (clientName: string): Promise<SignInSession> {
    if (this.active !== null) return this.active

    const store = this.selection.requireCurrentStore()
    const prompt = await this.catalogGateway.requestSignIn(store, clientName)
    this.cancelled = false

    const session: SignInSession = { prompt, finished: this.awaitAnswer(prompt) }
    this.active = session
    return session
  }

  /** Give up waiting. The code stays valid at the server until it expires by itself. */
  public cancelSignIn (): void {
    this.cancelled = true
  }

  public async signOut (): Promise<StoreAccount> {
    const store = this.selection.readCurrentStore()
    if (store === null) return NO_ACCOUNT

    this.cancelSignIn()
    return await this.catalogGateway.signOut(store)
  }

  private isCancelled (): boolean {
    return this.cancelled
  }

  private async awaitAnswer (prompt: SignInPrompt): Promise<SignInResult> {
    const store = this.selection.requireCurrentStore()
    const deadline = Date.now() + prompt.expiresInSeconds * 1000

    try {
      while (!this.isCancelled()) {
        await delay(prompt.intervalSeconds * 1000)
        // Read through a method, not the field: cancelling happens *during* the delay
        // above, and a flow analysis that only sees the loop condition concludes this
        // can never be true.
        if (this.isCancelled()) break
        // The server's own expiry is the authority; this one only stops the loop when
        // the server has stopped answering at all.
        if (Date.now() > deadline) return { outcome: 'expired', account: await this.readAccount() }

        const result = await this.catalogGateway.pollSignIn(store, prompt.deviceCode)
        if (result.state === 'approved') return { outcome: 'signedIn', account: result.account }
        if (result.state === 'denied') return { outcome: 'denied', account: result.account }
        if (result.state === 'expired') return { outcome: 'expired', account: result.account }
      }
      return { outcome: 'cancelled', account: await this.readAccount() }
    } finally {
      this.active = null
    }
  }
}

async function delay (milliseconds: number): Promise<void> {
  await new Promise<void>((resolve: () => void): void => {
    setTimeout((): void => { resolve() }, milliseconds)
  })
}
