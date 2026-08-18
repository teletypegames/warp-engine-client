import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  BRIDGE_GLOBAL_NAME, type BridgeApi, type StreamListener
} from '../shared/contracts/BridgeApi'
import { IPC_CHANNELS } from '../shared/contracts/IpcChannels'
import type { AppStateDto } from '../shared/contracts/dto/AppStateDto'
import type { CatalogListingDto } from '../shared/contracts/dto/CatalogListingDto'
import type { InstalledStoreDto } from '../shared/contracts/dto/InstalledStoreDto'
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
const bridge: BridgeApi = {
  readState: async (): Promise<AppStateDto> =>
    ipcRenderer.invoke(IPC_CHANNELS.appReadState) as Promise<AppStateDto>,
  updateLocale: async (locale: string): Promise<LocaleSelectionDto> =>
    ipcRenderer.invoke(IPC_CHANNELS.appUpdateLocale, locale) as Promise<LocaleSelectionDto>,
  updateNavOpen: async (open: boolean): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.appUpdateNavOpen, open) as Promise<boolean>,

  listGames: async (): Promise<CatalogListingDto> =>
    ipcRenderer.invoke(IPC_CHANNELS.catalogListGames) as Promise<CatalogListingDto>,
  readPaths: async (): Promise<StorePathsDto> =>
    ipcRenderer.invoke(IPC_CHANNELS.catalogReadPaths) as Promise<StorePathsDto>,
  syncGames: async (names: readonly string[]): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.catalogSyncGames, names) as Promise<void>,
  removeGame: async (name: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.catalogRemoveGame, name) as Promise<void>,
  launchGame: async (name: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.catalogLaunchGame, name) as Promise<boolean>,

  listRegistryStores: async (): Promise<RegistryResultDto> =>
    ipcRenderer.invoke(IPC_CHANNELS.storeListRegistry) as Promise<RegistryResultDto>,
  installStore: async (store: RegistryStoreDto): Promise<InstalledStoreDto> =>
    ipcRenderer.invoke(IPC_CHANNELS.storeInstallStore, store) as Promise<InstalledStoreDto>,
  selectStore: async (home: string): Promise<StoreSelectionDto> =>
    ipcRenderer.invoke(IPC_CHANNELS.storeSelectStore, home) as Promise<StoreSelectionDto>,

  openFolder: async (directory: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.appOpenFolder, directory) as Promise<boolean>,
  openUrl: async (url: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.appOpenUrl, url) as Promise<boolean>,

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
  onBusyChanged: (listener: StreamListener<boolean>): void => {
    ipcRenderer.on(IPC_CHANNELS.streamBusyChanged, (_event: IpcRendererEvent, busy: boolean): void => {
      listener(busy)
    })
  }
}

contextBridge.exposeInMainWorld(BRIDGE_GLOBAL_NAME, bridge)
