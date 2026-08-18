/** A store engine installed on this machine, with everything needed to run it. */
export interface InstalledStore {
  readonly id: string
  readonly name: string
  readonly home: string
  readonly scriptPath: string
  readonly configPath: string
  readonly engine: string
}
