import type { AccountDto, SignInPromptDto } from '../../shared/contracts/dto/AccountDto'
import type { AppStateDto, ViewMode } from '../../shared/contracts/dto/AppStateDto'
import type { GameDto } from '../../shared/contracts/dto/GameDto'
import type { InstalledStoreDto } from '../../shared/contracts/dto/InstalledStoreDto'
import type { StorePathsDto } from '../../shared/contracts/dto/StorePathsDto'
import { ENGLISH_MESSAGES } from '../../shared/i18n/EnglishMessages'
import type { Locale, MessageBundle } from '../../shared/i18n/MessageBundle'
import { EVERYTHING, resolveFilter, type CatalogFilter } from './CatalogFilter'
import type { ClientUpdatePresentation } from './ClientUpdatePresentation'
import type { GatePresentation } from './GatePresentation'

/** How far a running sync has got, for the counter in the bar. */
export interface SyncProgress {
  readonly total: number
  readonly done: number
  readonly label: string
}

/** How much of the store's output the window keeps; older lines fall off the top. */
const MAX_LOG_LINES = 400

/** Everything the window draws itself from. Read-only to everyone but the store. */
export interface AppState {
  readonly locale: Locale
  readonly locales: readonly Locale[]
  readonly messages: MessageBundle
  readonly navigationOpen: boolean
  readonly stores: readonly InstalledStoreDto[]
  readonly currentStore: InstalledStoreDto | null
  readonly registryUrl: string
  readonly defaultStoreRoot: string
  readonly games: readonly GameDto[]
  readonly paths: StorePathsDto | null
  /** Always consistent with `games`: an axis pointing at nothing is cleared on the way in. */
  readonly filter: CatalogFilter
  readonly busy: boolean
  readonly progress: SyncProgress | null
  /** Non-null while the setup screen is up, which is also what hides the grid. */
  readonly gate: GatePresentation | null
  /** Where this machine stands with the open store. */
  readonly account: AccountDto
  /** Non-null while a code is on screen waiting to be typed into a browser. */
  readonly signIn: SignInPromptDto | null
  readonly appVersion: string
  /** Null until someone asks whether a newer client is published. */
  readonly clientUpdate: ClientUpdatePresentation | null
  readonly viewMode: ViewMode
  /** The store's own output, newest last, capped at `MAX_LOG_LINES`. */
  readonly logLines: readonly string[]
  readonly logOpen: boolean
}

const INITIAL_STATE: AppState = {
  locale: 'en',
  locales: ['en'],
  messages: ENGLISH_MESSAGES,
  navigationOpen: true,
  stores: [],
  currentStore: null,
  registryUrl: '',
  defaultStoreRoot: '',
  games: [],
  paths: null,
  filter: EVERYTHING,
  busy: false,
  progress: null,
  gate: null,
  account: { signInAvailable: false, signedIn: false },
  signIn: null,
  appVersion: '',
  clientUpdate: null,
  viewMode: 'grid',
  logLines: [],
  logOpen: false
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
      stores: dto.stores,
      currentStore: dto.currentStore,
      registryUrl: dto.registryUrl,
      defaultStoreRoot: dto.defaultStoreRoot,
      appVersion: dto.appVersion,
      viewMode: dto.viewMode
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

  /**
   * A new listing, and the filter checked against it.
   *
   * A filter can outlive what it points at — the last title of a platform is removed,
   * an update is applied — so it is corrected here, where the games change, rather than
   * caught while drawing. The menu and the grid then never disagree about what is on.
   */
  public applyCatalog (
    games: readonly GameDto[],
    paths: StorePathsDto | null,
    account: AccountDto
  ): void {
    this.state = {
      ...this.state,
      games,
      paths: paths ?? this.state.paths,
      account,
      filter: resolveFilter(this.state.filter, games)
    }
    this.notify()
  }

  public applyAccount (account: AccountDto): void {
    this.state = { ...this.state, account }
    this.notify()
  }

  public applySignIn (prompt: SignInPromptDto | null): void {
    this.state = { ...this.state, signIn: prompt }
    this.notify()
  }

  public applySelectedStore (store: InstalledStoreDto): void {
    // A new store means a new account: whether we are signed in is per store, and
    // carrying the old answer over would show somebody as signed in to a shop they
    // have never visited.
    this.state = {
      ...this.state,
      currentStore: store,
      games: [],
      paths: null,
      filter: EVERYTHING,
      account: { signInAvailable: false, signedIn: false },
      signIn: null
    }
    this.notify()
  }

  public applyGate (gate: GatePresentation | null): void {
    this.state = { ...this.state, gate }
    this.notify()
  }

  public applyFilter (filter: CatalogFilter): void {
    this.state = { ...this.state, filter: resolveFilter(filter, this.state.games) }
    this.notify()
  }

  public applyBusy (busy: boolean): void {
    this.state = { ...this.state, busy, progress: busy ? this.state.progress : null }
    this.notify()
  }

  public applyClientUpdate (clientUpdate: ClientUpdatePresentation | null): void {
    this.state = { ...this.state, clientUpdate }
    this.notify()
  }

  public applyViewMode (viewMode: ViewMode): void {
    this.state = { ...this.state, viewMode }
    this.notify()
  }

  public applyProgress (progress: SyncProgress | null): void {
    this.state = { ...this.state, progress }
    this.notify()
  }

  /**
   * One more line from the store.
   *
   * A line arriving while the drawer is shut does not open it: the store logs on every
   * refresh, and a window that unfolded a panel by itself would be worse than one that
   * kept quiet. The lines are kept, so opening it later shows what happened.
   */
  public applyLogLine (line: string): void {
    const lines = [...this.state.logLines, line]
    this.state = { ...this.state, logLines: lines.slice(Math.max(0, lines.length - MAX_LOG_LINES)) }
    this.notify()
  }

  public applyLogOpen (open: boolean): void {
    this.state = { ...this.state, logOpen: open }
    this.notify()
  }

  private notify (): void {
    for (const listener of this.listeners) listener(this.state)
  }
}
