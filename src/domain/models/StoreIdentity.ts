import type { RegistryStore } from './RegistryStore'

/**
 * A store id, from whatever the registry gave us.
 *
 * The id names the store home, the folder games land in and the launcher files, so
 * it has to be short and filesystem-safe. Three sources, in order of how much they
 * were meant to be a name:
 *
 *   1. the repository name — `ttg-desktop-store` becomes `ttg`;
 *   2. the catalog host — `https://teletypegames.org` becomes `teletypegames`;
 *   3. the display name, slugged, as a last resort.
 *
 * The store's own config.json overrides all of it whenever one exists.
 */
export function deriveStoreId (store: RegistryStore): string {
  const fromRepository = store.storeRepositoryUrl === null
    ? ''
    : (lastSegment(store.storeRepositoryUrl).replace(/-(desktop-)?store$/, ''))
  return toSlug(fromRepository) || toSlug(readHostLabel(store.catalogUrl)) || toSlug(store.name) || 'store'
}

function lastSegment (url: string): string {
  return url.replace(/\/+$/, '').split('/').pop() ?? ''
}

/** `https://www.teletypegames.org/x` → `teletypegames`. */
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
