import type { Brand } from '../../domain/models/Brand'
import type { BrandDto } from '../../shared/contracts/dto/BrandDto'

export class BrandDtoMapper {
  public toDto (brand: Brand): BrandDto {
    return { name: brand.name, catalogUrl: brand.catalogUrl }
  }
}
