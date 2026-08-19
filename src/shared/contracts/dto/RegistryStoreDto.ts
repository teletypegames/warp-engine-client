/** A store the registry offers, before anything is installed. */
export interface RegistryStoreDto {
  readonly name: string
  readonly catalogUrl: string
  /** Derived from the catalog host, or the name — what the store will be called on disk. */
  readonly storeId: string
}
