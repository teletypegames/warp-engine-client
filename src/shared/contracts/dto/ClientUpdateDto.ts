/** The answer to "is there a newer client?", as the window shows it. */
export interface ClientUpdateDto {
  readonly currentVersion: string
  readonly latestVersion: string
  readonly releaseUrl: string
  readonly updateAvailable: boolean
}
