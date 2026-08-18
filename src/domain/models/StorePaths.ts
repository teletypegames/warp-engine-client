/** The store's resolved locations on this machine, as the engine reports them. */
export interface StorePaths {
  readonly operatingSystem: string
  readonly architecture: string
  readonly installRoot: string
  readonly menuDirectory: string
  readonly storeFolder: string
  readonly menuGroup: string
  readonly catalogBaseUrl: string
  readonly storeName: string
  readonly storeId: string
}
