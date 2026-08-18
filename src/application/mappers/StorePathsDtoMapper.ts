import type { StorePaths } from '../../domain/models/StorePaths'
import type { StorePathsDto } from '../../shared/contracts/dto/StorePathsDto'

export class StorePathsDtoMapper {
  public toDto (paths: StorePaths): StorePathsDto {
    return {
      operatingSystem: paths.operatingSystem,
      architecture: paths.architecture,
      storeFolder: paths.storeFolder,
      menuGroup: paths.menuGroup,
      catalogBaseUrl: paths.catalogBaseUrl,
      storeName: paths.storeName,
      storeId: paths.storeId
    }
  }
}
