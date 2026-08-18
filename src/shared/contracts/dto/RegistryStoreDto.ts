/** A store the registry offers, before anything is installed. */
export interface RegistryStoreDto {
  readonly name: string
  readonly catalogUrl: string
  /** Null when the store has no repository of its own; the engine's defaults are then used. */
  readonly storeRepositoryUrl: string | null
  /** Derived from the repository, the catalog host or the name — what the store will be called on disk. */
  readonly storeId: string
}
