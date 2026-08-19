import type { RegistryStore } from '../../domain/models/RegistryStore'
import { deriveStoreId } from '../../domain/models/StoreIdentity'
import type { RegistryStoreDto } from '../../shared/contracts/dto/RegistryStoreDto'

export class RegistryStoreDtoMapper {
  public toDto (store: RegistryStore): RegistryStoreDto {
    return {
      name: store.name,
      catalogUrl: store.catalogUrl,
      storeId: deriveStoreId(store)
    }
  }

  public toDtoList (stores: readonly RegistryStore[]): readonly RegistryStoreDto[] {
    return stores.map((store: RegistryStore): RegistryStoreDto => this.toDto(store))
  }

  /** The window hands a record straight back when asking for an install. */
  public toModel (dto: RegistryStoreDto): RegistryStore {
    return { name: dto.name, catalogUrl: dto.catalogUrl }
  }
}
