/**
 * Whether this machine is signed in to one store, and whether it could be.
 *
 * Two booleans rather than one, because the interesting case is the first being false:
 * most catalogs have no sign-in at all, and a client that shows a greyed-out "Sign in"
 * on them is telling people about a door that does not exist.
 */
export interface StoreAccount {
  readonly signInAvailable: boolean
  readonly signedIn: boolean
}

export const NO_ACCOUNT: StoreAccount = { signInAvailable: false, signedIn: false }

/** What to show a person while they finish signing in somewhere else. */
export interface SignInPrompt {
  /** Opaque to the window: it is the client's half of the exchange, not the person's. */
  readonly deviceCode: string
  /** The short one, shown on screen and typed into a browser. */
  readonly userCode: string
  /** Opened in the person's own browser. */
  readonly verificationUrl: string
  readonly intervalSeconds: number
  readonly expiresInSeconds: number
}

/** How a sign-in ended. `cancelled` is this side giving up, `denied` is the person. */
export type SignInOutcome = 'signedIn' | 'denied' | 'expired' | 'cancelled'
