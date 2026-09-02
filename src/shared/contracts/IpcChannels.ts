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
  appUpdateViewMode: 'app:updateViewMode',
  appOpenUrl: 'app:openUrl',

  catalogListGames: 'catalog:listGames',
  catalogReadPaths: 'catalog:readPaths',
  catalogSyncGames: 'catalog:syncGames',
  catalogRemoveGame: 'catalog:removeGame',
  catalogLaunchGame: 'catalog:launchGame',

  accountRead: 'account:read',
  accountBeginSignIn: 'account:beginSignIn',
  accountCancelSignIn: 'account:cancelSignIn',
  accountSignOut: 'account:signOut',

  storeListRegistry: 'store:listRegistry',
  storeInstallStore: 'store:installStore',
  storeInstallCatalog: 'store:installCatalog',
  storeSelectStore: 'store:selectStore',
  storeRemoveStore: 'store:removeStore',

  /** Main to renderer, one way. */
  streamLog: 'stream:log',
  streamSyncEvent: 'stream:syncEvent',
  streamBusyChanged: 'stream:busyChanged',
  /** How a sign-in ended, once the browser half is done. */
  streamSignInFinished: 'stream:signInFinished'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
