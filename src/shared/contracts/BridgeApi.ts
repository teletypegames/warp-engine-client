import type { AccountDto, SignInFinishedDto, SignInPromptDto } from './dto/AccountDto'
import type { AppStateDto, ViewMode } from './dto/AppStateDto'
import type { CatalogListingDto } from './dto/CatalogListingDto'
import type { LocaleSelectionDto } from './dto/LocaleSelectionDto'
import type { RegistryResultDto } from './dto/RegistryResultDto'
import type { RegistryStoreDto } from './dto/RegistryStoreDto'
import type { StorePathsDto } from './dto/StorePathsDto'
import type { StoreSelectionDto } from './dto/StoreSelectionDto'
import type { SyncEventDto } from './dto/SyncEventDto'

/** A stream the main process pushes; the window subscribes and never replies. */
export type StreamListener<TPayload> = (payload: TPayload) => void

/**
 * The entire surface the window gets.
 *
 * Nothing else reaches it: no Node, no filesystem, no child processes. Both sides
 * compile against this interface, so a method the preload does not expose is a
 * compile error in the renderer rather than an `undefined is not a function` at
 * runtime.
 */
export interface BridgeApi {
  readState: () => Promise<AppStateDto>
  updateLocale: (locale: string) => Promise<LocaleSelectionDto>
  updateNavOpen: (open: boolean) => Promise<boolean>
  updateViewMode: (mode: ViewMode) => Promise<ViewMode>

  listGames: () => Promise<CatalogListingDto>
  readPaths: () => Promise<StorePathsDto>
  syncGames: (names: readonly string[]) => Promise<void>
  removeGame: (name: string) => Promise<void>
  launchGame: (name: string) => Promise<boolean>

  readAccount: () => Promise<AccountDto>
  /** Answers with the code to show; how it ended arrives on `onSignInFinished`. */
  beginSignIn: () => Promise<SignInPromptDto>
  cancelSignIn: () => Promise<void>
  signOut: () => Promise<AccountDto>

  listRegistryStores: () => Promise<RegistryResultDto>
  /** Answers with the application state afterwards, the new store open. */
  installStore: (store: RegistryStoreDto) => Promise<AppStateDto>
  /** A catalog the registry does not list; the name is derived from the address. */
  installCatalog: (catalogUrl: string) => Promise<AppStateDto>
  selectStore: (home: string) => Promise<StoreSelectionDto>
  /**
   * Uninstall everything the store put here, then remove the store itself. Answers
   * with the application state afterwards: which store is open next is decided here.
   */
  removeStore: (home: string) => Promise<AppStateDto>

  openFolder: (directory: string) => Promise<boolean>
  openUrl: (url: string) => Promise<boolean>

  onLog: (listener: StreamListener<string>) => void
  onSyncEvent: (listener: StreamListener<SyncEventDto>) => void
  onBusyChanged: (listener: StreamListener<boolean>) => void
  onSignInFinished: (listener: StreamListener<SignInFinishedDto>) => void
}

/** The name the bridge is published under on `window`. */
export const BRIDGE_GLOBAL_NAME = 'storeApi'
