import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  BRIDGE_GLOBAL_NAME, type BridgeApi, type StreamListener
} from '../shared/contracts/BridgeApi'
import { IPC_CHANNELS, type IpcChannel } from '../shared/contracts/IpcChannels'
import type {
  AccountDto, SignInFinishedDto, SignInPromptDto
} from '../shared/contracts/dto/AccountDto'
import type { AppStateDto, ViewMode } from '../shared/contracts/dto/AppStateDto'
import type { CatalogListingDto } from '../shared/contracts/dto/CatalogListingDto'
import type { CatalogPageDto } from '../shared/contracts/dto/CatalogPageDto'
import type { ClientUpdateDto } from '../shared/contracts/dto/ClientUpdateDto'
import type { LocaleSelectionDto } from '../shared/contracts/dto/LocaleSelectionDto'
import type { RegistryResultDto } from '../shared/contracts/dto/RegistryResultDto'
import type { RegistryStoreDto } from '../shared/contracts/dto/RegistryStoreDto'
import type { StorePathsDto } from '../shared/contracts/dto/StorePathsDto'
import type { StoreSelectionDto } from '../shared/contracts/dto/StoreSelectionDto'
import type { SyncEventDto } from '../shared/contracts/dto/SyncEventDto'

/**
 * The bridge, and nothing else.
 *
 * This file is the whole surface the window gets: no Node, no filesystem, no child
 * processes. It is bundled into a single script on purpose — a sandboxed preload
 * cannot require its own modules — and it implements `BridgeApi`, so the renderer
 * and the main process are compiled against the same contract.
 */
/**
 * The one cast in the bridge.
 *
 * `ipcRenderer.invoke` answers `Promise<any>`, and the main process's controller for the
 * channel is what actually decides the type; both sides compile against `BridgeApi`, so
 * the assertion here is the contract restated once rather than twenty times below.
 */
async function invoke<TResult> (channel: IpcChannel, ...args: readonly unknown[]): Promise<TResult> {
  return await (ipcRenderer.invoke(channel, ...args) as Promise<TResult>)
}

const bridge: BridgeApi = {
  readState: async (): Promise<AppStateDto> =>
    invoke<AppStateDto>(IPC_CHANNELS.appReadState),
  updateLocale: async (locale: string): Promise<LocaleSelectionDto> =>
    invoke<LocaleSelectionDto>(IPC_CHANNELS.appUpdateLocale, locale),
  updateNavOpen: async (open: boolean): Promise<boolean> =>
    invoke<boolean>(IPC_CHANNELS.appUpdateNavOpen, open),
  updateViewMode: async (mode: ViewMode): Promise<ViewMode> =>
    invoke<ViewMode>(IPC_CHANNELS.appUpdateViewMode, mode),

  listGames: async (): Promise<CatalogListingDto> =>
    invoke<CatalogListingDto>(IPC_CHANNELS.catalogListGames),
  readPaths: async (): Promise<StorePathsDto> =>
    invoke<StorePathsDto>(IPC_CHANNELS.catalogReadPaths),
  syncGames: async (names: readonly string[]): Promise<void> => {
    await invoke<unknown>(IPC_CHANNELS.catalogSyncGames, names)
  },
  removeGame: async (name: string): Promise<void> => {
    await invoke<unknown>(IPC_CHANNELS.catalogRemoveGame, name)
  },
  reinstallGame: async (name: string): Promise<void> => {
    await invoke<unknown>(IPC_CHANNELS.catalogReinstallGame, name)
  },
  launchGame: async (name: string): Promise<boolean> =>
    invoke<boolean>(IPC_CHANNELS.catalogLaunchGame, name),

  readAccount: async (): Promise<AccountDto> =>
    invoke<AccountDto>(IPC_CHANNELS.accountRead),
  beginSignIn: async (): Promise<SignInPromptDto> =>
    invoke<SignInPromptDto>(IPC_CHANNELS.accountBeginSignIn),
  cancelSignIn: async (): Promise<void> => {
    await invoke<unknown>(IPC_CHANNELS.accountCancelSignIn)
  },
  signOut: async (): Promise<AccountDto> =>
    invoke<AccountDto>(IPC_CHANNELS.accountSignOut),

  listRegistryStores: async (): Promise<RegistryResultDto> =>
    invoke<RegistryResultDto>(IPC_CHANNELS.storeListRegistry),
  installStore: async (store: RegistryStoreDto): Promise<AppStateDto> =>
    invoke<AppStateDto>(IPC_CHANNELS.storeInstallStore, store),
  installCatalog: async (catalogUrl: string, name?: string): Promise<AppStateDto> =>
    invoke<AppStateDto>(IPC_CHANNELS.storeInstallCatalog, catalogUrl, name ?? null),
  selectStore: async (home: string): Promise<StoreSelectionDto> =>
    invoke<StoreSelectionDto>(IPC_CHANNELS.storeSelectStore, home),
  removeStore: async (home: string): Promise<AppStateDto> =>
    invoke<AppStateDto>(IPC_CHANNELS.storeRemoveStore, home),
  renameStore: async (home: string, name: string): Promise<AppStateDto> =>
    invoke<AppStateDto>(IPC_CHANNELS.storeRenameStore, home, name),

  openFolder: async (directory: string): Promise<boolean> =>
    invoke<boolean>(IPC_CHANNELS.appOpenFolder, directory),
  openUrl: async (url: string): Promise<boolean> =>
    invoke<boolean>(IPC_CHANNELS.appOpenUrl, url),
  checkForUpdates: async (): Promise<ClientUpdateDto> =>
    invoke<ClientUpdateDto>(IPC_CHANNELS.appCheckForUpdates),

  onLog: (listener: StreamListener<string>): void => {
    ipcRenderer.on(IPC_CHANNELS.streamLog, (_event: IpcRendererEvent, line: string): void => {
      listener(line)
    })
  },
  onSyncEvent: (listener: StreamListener<SyncEventDto>): void => {
    ipcRenderer.on(IPC_CHANNELS.streamSyncEvent, (_event: IpcRendererEvent, payload: SyncEventDto): void => {
      listener(payload)
    })
  },
  onCatalogPage: (listener: StreamListener<CatalogPageDto>): void => {
    ipcRenderer.on(IPC_CHANNELS.streamCatalogPage, (_event: IpcRendererEvent, payload: CatalogPageDto): void => {
      listener(payload)
    })
  },
  onBusyChanged: (listener: StreamListener<boolean>): void => {
    ipcRenderer.on(IPC_CHANNELS.streamBusyChanged, (_event: IpcRendererEvent, busy: boolean): void => {
      listener(busy)
    })
  },
  onSignInFinished: (listener: StreamListener<SignInFinishedDto>): void => {
    ipcRenderer.on(
      IPC_CHANNELS.streamSignInFinished,
      (_event: IpcRendererEvent, payload: SignInFinishedDto): void => { listener(payload) }
    )
  }
}

contextBridge.exposeInMainWorld(BRIDGE_GLOBAL_NAME, bridge)
