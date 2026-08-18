import type { AppStateDto } from '../../shared/contracts/dto/AppStateDto'
import type { EngineVersionDto } from '../../shared/contracts/dto/EngineVersionDto'
import type { GameDto } from '../../shared/contracts/dto/GameDto'
import type { InstalledStoreDto } from '../../shared/contracts/dto/InstalledStoreDto'
import type { StorePathsDto } from '../../shared/contracts/dto/StorePathsDto'
import { ENGLISH_MESSAGES } from '../../shared/i18n/EnglishMessages'
import type { Locale, MessageBundle } from '../../shared/i18n/MessageBundle'
import { ALL_CATEGORIES, type CategoryFilter } from './CategoryFilter'
import type { GatePresentation } from './GatePresentation'

/** How far a running sync has got, for the counter in the bar. */
export interface SyncProgress {
  readonly total: number
  readonly done: number
  readonly label: string
}

/** Everything the window draws itself from. Read-only to everyone but the store. */
export interface AppState {
  readonly locale: Locale
  readonly locales: readonly Locale[]
  readonly messages: MessageBundle
  readonly navigationOpen: boolean
  readonly pythonVersion: string | null
  readonly stores: readonly InstalledStoreDto[]
  readonly currentStore: InstalledStoreDto | null
  readonly engine: EngineVersionDto | null
  readonly minimumEngineVersion: string
  readonly registryUrl: string
  readonly defaultStoreRoot: string
  readonly games: readonly GameDto[]
  readonly paths: StorePathsDto | null
  readonly filter: CategoryFilter
  readonly busy: boolean
  readonly progress: SyncProgress | null
  /** Non-null while the setup screen is up, which is also what hides the grid. */
  readonly gate: GatePresentation | null
}

const INITIAL_STATE: AppState = {
  locale: 'en',
  locales: ['en'],
  messages: ENGLISH_MESSAGES,
  navigationOpen: true,
  pythonVersion: null,
  stores: [],
  currentStore: null,
  engine: null,
  minimumEngineVersion: '',
  registryUrl: '',
  defaultStoreRoot: '',
  games: [],
  paths: null,
  filter: ALL_CATEGORIES,
  busy: false,
  progress: null,
  gate: null
}

export type AppStateListener = (state: AppState) => void

/**
 * The window's single source of truth.
 *
 * Every mutator is named after what it changes, and every one of them notifies: the
 * views re-render from the state rather than being poked individually, so there is no
 * way to update the model and forget the screen.
 */
export class AppStore {
  private state: AppState = INITIAL_STATE
  private readonly listeners: AppStateListener[] = []

  public readState (): AppState {
    return this.state
  }

  public subscribe (listener: AppStateListener): void {
    this.listeners.push(listener)
  }

  public applyAppState (dto: AppStateDto): void {
    this.state = {
      ...this.state,
      locale: dto.locale,
      locales: dto.locales,
      messages: dto.messages,
      navigationOpen: dto.navigationOpen,
      pythonVersion: dto.pythonVersion,
      stores: dto.stores,
      currentStore: dto.currentStore,
      engine: dto.engine,
      minimumEngineVersion: dto.minimumEngineVersion,
      registryUrl: dto.registryUrl,
      defaultStoreRoot: dto.defaultStoreRoot
    }
    this.notify()
  }

  public applyMessages (locale: Locale, messages: MessageBundle): void {
    this.state = { ...this.state, locale, messages }
    this.notify()
  }

  public applyNavigationOpen (open: boolean): void {
    this.state = { ...this.state, navigationOpen: open }
    this.notify()
  }

  public applyCatalog (games: readonly GameDto[], paths: StorePathsDto | null): void {
    this.state = { ...this.state, games, paths: paths ?? this.state.paths }
    this.notify()
  }

  public applySelectedStore (store: InstalledStoreDto, engine: EngineVersionDto | null): void {
    this.state = { ...this.state, currentStore: store, engine, games: [], paths: null, filter: ALL_CATEGORIES }
    this.notify()
  }

  public applyGate (gate: GatePresentation | null): void {
    this.state = { ...this.state, gate }
    this.notify()
  }

  public applyFilter (filter: CategoryFilter): void {
    this.state = { ...this.state, filter }
    this.notify()
  }

  public applyBusy (busy: boolean): void {
    this.state = { ...this.state, busy, progress: busy ? this.state.progress : null }
    this.notify()
  }

  public applyProgress (progress: SyncProgress | null): void {
    this.state = { ...this.state, progress }
    this.notify()
  }

  private notify (): void {
    for (const listener of this.listeners) listener(this.state)
  }
}
