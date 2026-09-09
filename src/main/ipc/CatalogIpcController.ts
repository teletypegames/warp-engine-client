import type { CatalogService } from '../../application/services/CatalogService'
import type { GameLaunchService } from '../../application/services/GameLaunchService'
import type { AccountDtoMapper } from '../../application/mappers/AccountDtoMapper'
import type { GameDtoMapper } from '../../application/mappers/GameDtoMapper'
import type { StorePathsDtoMapper } from '../../application/mappers/StorePathsDtoMapper'
import { IPC_CHANNELS } from '../../shared/contracts/IpcChannels'
import type { CatalogListingDto } from '../../shared/contracts/dto/CatalogListingDto'
import type { StorePathsDto } from '../../shared/contracts/dto/StorePathsDto'
import type { WindowStreamBroadcaster } from '../streams/WindowStreamBroadcaster'
import { requireString, requireStringArray } from './IpcArguments'
import type { IpcRouter } from './IpcRouter'
import type { SingleFlightGuard } from './SingleFlightGuard'

/**
 * Everything that touches the catalog.
 *
 * The four engine calls go through the guard; launching does not, because it starts
 * someone else's program and writes nothing.
 */
export class CatalogIpcController {
  public constructor (
    private readonly catalog: CatalogService,
    private readonly launching: GameLaunchService,
    private readonly guard: SingleFlightGuard,
    private readonly streams: WindowStreamBroadcaster,
    private readonly gameMapper: GameDtoMapper,
    private readonly pathsMapper: StorePathsDtoMapper,
    private readonly accountMapper: AccountDtoMapper
  ) {}

  public register (router: IpcRouter): void {
    router.handle(IPC_CHANNELS.catalogListGames, async (): Promise<CatalogListingDto> =>
      this.handleListGames())
    router.handle(IPC_CHANNELS.catalogReadPaths, async (): Promise<StorePathsDto> =>
      this.handleReadPaths())
    router.handle(IPC_CHANNELS.catalogSyncGames, async (names: unknown): Promise<void> =>
      this.handleSyncGames(names === undefined ? [] : requireStringArray(names, 'names')))
    router.handle(IPC_CHANNELS.catalogRemoveGame, async (name: unknown): Promise<void> =>
      this.handleRemoveGame(requireString(name, 'name')))
    router.handle(IPC_CHANNELS.catalogLaunchGame, async (name: unknown): Promise<boolean> =>
      this.handleLaunchGame(requireString(name, 'name')))
  }

  private async handleListGames (): Promise<CatalogListingDto> {
    return this.guard.run(async (): Promise<CatalogListingDto> => {
      const listing = await this.catalog.listGames(this.streams.asProgressListener())
      const baseUrl = listing.paths?.catalogBaseUrl ?? ''
      return {
        games: this.gameMapper.toDtoList(listing.games, baseUrl),
        skipped: listing.skipped,
        paths: listing.paths === null ? null : this.pathsMapper.toDto(listing.paths),
        account: this.accountMapper.toDto(listing.account)
      }
    })
  }

  private async handleReadPaths (): Promise<StorePathsDto> {
    return this.guard.run(async (): Promise<StorePathsDto> =>
      this.pathsMapper.toDto(await this.catalog.readPaths(this.streams.asProgressListener())))
  }

  private async handleSyncGames (names: readonly string[]): Promise<void> {
    await this.guard.run(async (): Promise<void> => {
      await this.catalog.syncGames(names, this.streams.asProgressListener())
    })
  }

  private async handleRemoveGame (name: string): Promise<void> {
    await this.guard.run(async (): Promise<void> => {
      await this.catalog.removeGame(name, this.streams.asProgressListener())
    })
  }

  private async handleLaunchGame (name: string): Promise<boolean> {
    return this.launching.launchGame(name)
  }
}
