/**
 * Where a store's sign-in token is kept between runs.
 *
 * One token per store, keyed by store id, because the client serves several stores at
 * once and being signed in to one says nothing about the others.
 *
 * A port rather than a file path because the storage is the host's business: on a
 * desktop it is the OS keychain, in a test it is a map. Nothing above this layer knows
 * which, and nothing above it should — the token is the one value in this application
 * that must not end up somewhere it can be read by looking.
 */
export interface CredentialRepository {
  readToken: (storeId: string) => string | null
  writeToken: (storeId: string, token: string) => void
  clearToken: (storeId: string) => void
}
