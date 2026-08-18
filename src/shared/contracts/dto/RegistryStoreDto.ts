/** A store the registry offers, before anything is installed. */
export interface RegistryStoreDto {
  readonly name: string
  readonly catalogUrl: string
  readonly storeRepositoryUrl: string
  /** Derived from the repository name, so the picker can show what it will become. */
  readonly storeId: string
}
