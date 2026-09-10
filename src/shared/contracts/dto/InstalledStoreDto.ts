/** A store on this machine, as the switcher lists it. */
export interface InstalledStoreDto {
  readonly id: string
  readonly name: string
  readonly home: string
  readonly catalogUrl: string
  readonly engine: string
}
