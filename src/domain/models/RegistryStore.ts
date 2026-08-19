/**
 * A store the site's registry offers.
 *
 * A name and a catalog are what make a store; the other two fields are optional.
 *
 * `config` is how that store behaves — which platforms it offers, which release
 * statuses it shows, where its games land — in the same shape a store's `config.json`
 * had, because it is the same thing moved into the registry. With none, the engine's
 * defaults cover all of it and this record covers the identity, which is why a store
 * needs nothing of its own to be installable.
 *
 * `storeRepositoryUrl` is where the store's own repository is, when it has one. It is
 * still read as a config source for a registry that has not moved its stores over yet.
 */
export interface RegistryStore {
  readonly name: string
  readonly catalogUrl: string
  readonly storeRepositoryUrl: string | null
  /**
   * Deliberately not `JsonRecord`: `domain` imports nothing from `infrastructure`, and
   * a JSON object is describable without it.
   */
  readonly config: Readonly<Record<string, unknown>> | null
}
