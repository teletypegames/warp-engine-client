/**
 * This client as a title in a catalog: the catalog it is published in, and its name there.
 *
 * The client is an `electron` platform project like any other, so its releases are a
 * catalog entry. Two things follow from knowing which: *Check for updates* reads that
 * entry, and the store opened on that catalog leaves the entry out of its grid — a
 * client offering to install itself is a loop, not a feature.
 */
export interface ClientIdentity {
  readonly catalogUrl: string
  readonly name: string
}

/** Whether the title `gameName` in the store at `storeCatalogUrl` is this client itself. */
export function isClientItself (identity: ClientIdentity | null, storeCatalogUrl: string, gameName: string): boolean {
  if (identity === null) return false
  if (gameName !== identity.name) return false
  return readOrigin(storeCatalogUrl) === readOrigin(identity.catalogUrl)
}

function readOrigin (url: string): string {
  try {
    const parsed = new URL(url.includes('://') ? url : `https://${url}`)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase()
  } catch {
    return url.trim().replace(/\/+$/, '').toLowerCase()
  }
}
