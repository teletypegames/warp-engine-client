/**
 * A store the site's registry offers.
 *
 * Three fields, because that is what a record is: what it is called, which
 * catalog it serves, and where its configuration lives.
 */
export interface RegistryStore {
  readonly name: string
  readonly catalogUrl: string
  readonly storeRepositoryUrl: string
}
