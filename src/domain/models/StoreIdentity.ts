import type { RegistryStore } from './RegistryStore'

/**
 * A store id, from whatever the registry gave us.
 *
 * The id names the store home, the folder games land in and the launcher files, so it
 * has to be short and filesystem-safe. Two sources, in order of how much they were
 * meant to be a name:
 *
 *   1. the catalog host — `https://teletypegames.org` becomes `teletypegames`;
 *   2. the display name, slugged, as a last resort.
 *
 * Derived rather than carried, and derived from the catalog: the catalog is what a store
 * *is*, so two records naming the same catalog are the same store and land in the same
 * place, which is what keeps a reinstall from orphaning what is already there.
 */
export function deriveStoreId (store: RegistryStore): string {
  return toSlug(readHostLabel(store.catalogUrl)) || toSlug(store.name) || 'store'
}

/** `https://www.teletypegames.org/x` -> `teletypegames`. */
function readHostLabel (catalogUrl: string): string {
  try {
    const host = new URL(catalogUrl).hostname.replace(/^www\./, '')
    return host.split('.')[0] ?? ''
  } catch {
    return ''
  }
}

function toSlug (value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}
