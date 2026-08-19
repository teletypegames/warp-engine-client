/** Where this machine stands with one store. */
export interface AccountDto {
  readonly signInAvailable: boolean
  readonly signedIn: boolean
}

/** What to show while somebody finishes signing in in their browser. */
export interface SignInPromptDto {
  /** The short code, read off this screen and typed into a browser. */
  readonly userCode: string
  readonly verificationUrl: string
  readonly expiresInSeconds: number
}

export type SignInOutcomeDto = 'signedIn' | 'denied' | 'expired' | 'cancelled'

/** The end of a sign-in, pushed to the window when the waiting is over. */
export interface SignInFinishedDto {
  readonly outcome: SignInOutcomeDto
  readonly account: AccountDto
}
