import type { EngineVersion } from '../../domain/models/EngineVersion'
import type { EngineVersionDto } from '../../shared/contracts/dto/EngineVersionDto'

export class EngineVersionDtoMapper {
  public toDto (version: EngineVersion): EngineVersionDto {
    return { text: version.text, supported: version.supported }
  }
}
