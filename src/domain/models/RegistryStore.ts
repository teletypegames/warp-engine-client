/**
 * A store the site's registry offers.
 *
 * A name and a catalog are what make a store; the repository is optional. When
 * there is one it stays the authority on how that store behaves — which platforms
 * it offers, where things land — and when there is not, the engine's own defaults
 * cover all of it and this record covers the identity. That is the whole reason a
 * store needs no repository of its own.
 */
export interface RegistryStore {
  readonly name: string
  readonly catalogUrl: string
  readonly storeRepositoryUrl: string | null
}
