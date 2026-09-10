/**
 * A store set up on this machine.
 *
 * A home and a config, which is all a store is now that the engine is part of this
 * application: the home holds the state and the catalog cache, and the config says
 * what the store offers and where its games go.
 */
export interface InstalledStore {
  readonly id: string
  readonly name: string
  readonly home: string
  readonly configPath: string
  /** The catalog the store is *of*: what the id, the home and the game folder derive from. */
  readonly catalogUrl: string
  readonly engine: string
}
