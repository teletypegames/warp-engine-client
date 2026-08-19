/**
 * A store the site's registry offers: a name and a catalog.
 *
 * That is the whole record, and it is enough. How a store behaves is not the registry's
 * business — this client carries its own store engine, whose defaults cover the
 * host-to-asset mapping, the install modes, the platforms and the behaviour — so what
 * was actually missing from those defaults is identity, and identity is all this is.
 *
 * Keeping two stores on one machine out of each other's files is a subfolder, derived
 * here from the store's own slug rather than told to us by a server.
 */
export interface RegistryStore {
  readonly name: string
  readonly catalogUrl: string
}
