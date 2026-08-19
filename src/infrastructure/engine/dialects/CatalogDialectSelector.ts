import type { SupportedWarpEngineVersion } from '../../../domain/models/WarpEngineVersion'
import { AccessAwareCatalogDialect } from './AccessAwareCatalogDialect'
import type { CatalogDialect } from './CatalogDialect'
import { SoftwareListCatalogDialect } from './SoftwareListCatalogDialect'

/**
 * Which dialect reads a catalog served by which engine version.
 *
 * The switch is exhaustive over `SUPPORTED_WARP_ENGINE_VERSIONS`, which is the whole
 * mechanism: adding a version to that list stops compiling here until somebody decides
 * what it reads like. Three versions share one dialect because the catalog's shape did
 * not change across them — and one class serving three versions is the honest way to
 * say that, rather than three identical ones pretending otherwise.
 *
 * 0.5 gets its own, because that is the engine that started saying what a title costs.
 */
export function selectCatalogDialect (version: SupportedWarpEngineVersion): CatalogDialect {
  switch (version) {
    case '0.2':
    case '0.3':
    case '0.4':
      return new SoftwareListCatalogDialect(version)
    case '0.5':
      return new AccessAwareCatalogDialect(version)
  }
}
