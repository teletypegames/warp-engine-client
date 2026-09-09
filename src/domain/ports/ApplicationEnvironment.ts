/** What the host application knows about itself: its version, locale and storage. */
export interface ApplicationEnvironment {
  readVersion (): string
  readSystemLocale (): string
  resolveUserDataPath (fileName: string): string
}
