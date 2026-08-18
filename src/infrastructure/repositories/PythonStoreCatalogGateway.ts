import type { CatalogListing } from '../../domain/models/CatalogListing'
import type { EngineProgressListener } from '../../domain/models/EngineProgress'
import {
  MINIMUM_ENGINE_VERSION, isAtLeast, parseVersionNumbers, type EngineVersion
} from '../../domain/models/EngineVersion'
import type { Game } from '../../domain/models/Game'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import type { StorePaths } from '../../domain/models/StorePaths'
import type { StoreCatalogGateway } from '../../domain/ports/StoreCatalogGateway'
import { readRecord, readRecordArray, readStringArray, type JsonRecord } from '../json/JsonRecord'
import { EngineGameMapper } from '../mappers/EngineGameMapper'
import { EngineStorePathsMapper } from '../mappers/EngineStorePathsMapper'
import type { PythonEngineProcessRunner } from '../process/PythonEngineProcessRunner'

/**
 * The store engine, driven as a child process.
 *
 * The only adapter that knows the CLI exists. Everything above it sees the port.
 */
export class PythonStoreCatalogGateway implements StoreCatalogGateway {
  public constructor (
    private readonly runner: PythonEngineProcessRunner,
    private readonly gameMapper: EngineGameMapper = new EngineGameMapper(),
    private readonly pathsMapper: EngineStorePathsMapper = new EngineStorePathsMapper()
  ) {}

  public async listGames (
    store: InstalledStore,
    progress?: EngineProgressListener
  ): Promise<CatalogListing> {
    const records = await this.runner.runCommand(store, ['list'], progress)
    const answer = this.lastRecord(records)
    if (answer === null) return { games: [], skipped: [], paths: null }
    const games: readonly Game[] = readRecordArray(answer, 'games')
      .map((record: JsonRecord): Game => this.gameMapper.toModel(record))
    const paths = readRecord(answer, 'paths')
    return {
      games,
      skipped: readStringArray(answer, 'skipped'),
      paths: paths === null ? null : this.pathsMapper.toModel(paths)
    }
  }

  public async readPaths (
    store: InstalledStore,
    progress?: EngineProgressListener
  ): Promise<StorePaths> {
    const records = await this.runner.runCommand(store, ['paths'], progress)
    const answer = this.lastRecord(records)
    return this.pathsMapper.toModel(answer ?? {})
  }

  public async syncGames (
    store: InstalledStore,
    names: readonly string[],
    progress?: EngineProgressListener
  ): Promise<void> {
    await this.runner.runCommand(store, ['sync', ...names], progress)
  }

  public async removeGame (
    store: InstalledStore,
    name: string,
    progress?: EngineProgressListener
  ): Promise<void> {
    await this.runner.runCommand(store, ['remove', name], progress)
  }

  public readEngineVersion (store: InstalledStore): EngineVersion | null {
    const text = this.runner.readVersionText(store)
    if (text === null) return null
    const numbers = parseVersionNumbers(text)
    return { text, numbers, supported: isAtLeast(numbers, MINIMUM_ENGINE_VERSION) }
  }

  /**
   * The result object is the last line: the stream events come first, and both
   * arrive on the same pipe.
   */
  private lastRecord (records: readonly JsonRecord[]): JsonRecord | null {
    for (let index = records.length - 1; index >= 0; index -= 1) {
      const record = records[index]
      if (record !== undefined && typeof record['event'] !== 'string') return record
    }
    return null
  }
}
