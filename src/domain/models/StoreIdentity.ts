import type { RegistryStore } from './RegistryStore'

/**
 * A store id from its repository name: `ttg-desktop-store` becomes `ttg`.
 *
 * The id names the store home and the folder games land in, so it has to be short
 * and filesystem-safe. The repository name is the best source available before
 * anything is downloaded; the store's own config.json overrides it once it is.
 */
export function deriveStoreId (store: RegistryStore): string {
  const lastSegment = store.storeRepositoryUrl.replace(/\/+$/, '').split('/').pop() ?? ''
  const base = lastSegment.replace(/-(desktop-)?store$/, '') || store.name
  const slug = base.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'store'
}
