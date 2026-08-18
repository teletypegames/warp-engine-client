import path from 'node:path'
import type { CatalogRelease } from './dialects/CatalogDialect'

export interface PickedRelease {
  readonly version: string
  readonly createdAt: string | null
  readonly assetName: string
  readonly kind: string
  readonly assetPath: string
}

/** `/file/blessingofra-2.0.0.prg` -> `blessingofra-2.0.0.prg`. */
export function assetBasename (assetPath: string): string {
  return path.posix.basename(assetPath.replace(/\/+$/, ''))
}

/**
 * The newest non-dev release that carries an asset kind we can use.
 *
 * The candidates arrive newest-first from the dialect, which is where knowing that the
 * API sorts them lives. Two rules decide the rest:
 *
 * **Release order wins over kind order.** The newest release that has *any* acceptable
 * kind is taken, and within it the most preferred kind. That is what a desktop host
 * wants: on Apple Silicon `mac_universal` beats `mac_x64`, which would need Rosetta,
 * but not at the price of installing an older release.
 *
 * **A `dev-` build is never taken.** It is a moving target, and installing one would
 * leave a menu entry pointing at an archive that is replaced without a version change.
 */
export function pickRelease (
  candidates: readonly CatalogRelease[],
  kinds: readonly string[],
  extension: string
): PickedRelease | null {
  for (const release of candidates) {
    if (release.version.startsWith('dev-')) continue
    for (const kind of kinds) {
      for (const asset of release.assets) {
        if (asset.kind !== kind) continue
        const assetName = assetBasename(asset.path)
        if (assetName.length === 0) continue
        if (extension.length > 0 && !assetName.toLowerCase().endsWith(extension.toLowerCase())) continue
        return {
          version: release.version,
          createdAt: release.createdAt,
          assetName,
          kind,
          assetPath: asset.path
        }
      }
    }
  }
  return null
}
