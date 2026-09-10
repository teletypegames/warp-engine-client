import type { SupportedWarpEngineVersion } from '../../../domain/models/WarpEngineVersion'
import { AccessAwareCatalogDialect } from './AccessAwareCatalogDialect'
import type { CatalogDialect } from './CatalogDialect'
import { SoftwareListCatalogDialect } from './SoftwareListCatalogDialect'

/**
 * Which dialect reads a catalog served by which engine version.
 *
 * The switch is exhaustive over `SUPPORTED_WARP_ENGINE_VERSIONS`, which is the whole
 * mechanism: adding a version to that list stops compiling here until somebody decides
 * what it reads like. Many versions share one dialect because the catalog's shape did
 * not change across them — and one class serving several versions is the honest way to
 * say that, rather than identical ones pretending otherwise.
 *
 * 0.5 started saying what a title costs, and every engine since reads the same way:
 * 0.6 to 0.11 changed storage, CI, images and the build matrix, none of which is the
 * catalog's shape, and 0.12 added an optional `category` that the dialect already
 * reads when it is there.
 */
export function selectCatalogDialect (version: SupportedWarpEngineVersion): CatalogDialect {
  switch (version) {
    case '0.2':
    case '0.3':
    case '0.4':
      return new SoftwareListCatalogDialect(version)
    case '0.5':
    case '0.6':
    case '0.7':
    case '0.8':
    case '0.9':
    case '0.10':
    case '0.11':
    case '0.12':
      return new AccessAwareCatalogDialect(version)
  }
}
