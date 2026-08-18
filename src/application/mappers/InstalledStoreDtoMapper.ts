import type { InstalledStore } from '../../domain/models/InstalledStore'
import type { InstalledStoreDto } from '../../shared/contracts/dto/InstalledStoreDto'

export class InstalledStoreDtoMapper {
  public toDto (store: InstalledStore): InstalledStoreDto {
    return { id: store.id, name: store.name, home: store.home, engine: store.engine }
  }

  public toDtoList (stores: readonly InstalledStore[]): readonly InstalledStoreDto[] {
    return stores.map((store: InstalledStore): InstalledStoreDto => this.toDto(store))
  }
}
