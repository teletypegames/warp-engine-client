/** Where a store puts things on this machine, as the log drawer reports it. */
export interface StorePathsDto {
  readonly operatingSystem: string
  readonly architecture: string
  readonly storeFolder: string
  readonly menuGroup: string
  readonly catalogBaseUrl: string
  readonly storeName: string
  readonly storeId: string
}
