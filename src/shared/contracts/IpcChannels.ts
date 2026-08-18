/**
 * Every channel name, in one frozen table.
 *
 * The pattern is `<domain>:<verb><Subject>` — the same verbs the services use, so
 * a channel, the bridge method it backs and the service call behind it read as one
 * sentence. Renderer and main both import this table; a typo cannot make a channel
 * that only one side knows about.
 */
export const IPC_CHANNELS = {
  appReadState: 'app:readState',
  appUpdateLocale: 'app:updateLocale',
  appUpdateNavOpen: 'app:updateNavOpen',
  appOpenFolder: 'app:openFolder',
  appOpenUrl: 'app:openUrl',

  catalogListGames: 'catalog:listGames',
  catalogReadPaths: 'catalog:readPaths',
  catalogSyncGames: 'catalog:syncGames',
  catalogRemoveGame: 'catalog:removeGame',
  catalogLaunchGame: 'catalog:launchGame',

  storeListRegistry: 'store:listRegistry',
  storeInstallStore: 'store:installStore',
  storeSelectStore: 'store:selectStore',

  /** Main to renderer, one way. */
  streamLog: 'stream:log',
  streamSyncEvent: 'stream:syncEvent',
  streamBusyChanged: 'stream:busyChanged'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
