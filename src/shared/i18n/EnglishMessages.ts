/**
 * The English message bundle, and the source of the key set.
 *
 * Every other language is typed against these keys, so a missing or misspelled
 * translation is a compile error rather than a blank label at runtime.
 */
export const ENGLISH_MESSAGES = {
  appName: 'WarpEngine Store',
  refresh: 'Refresh',
  install: 'Install',
  update: 'Update',
  play: 'Play',
  open: 'Open',
  remove: 'Remove',
  installed: 'installed',
  native: 'native',
  hosted: 'hosted',
  hostedHint: 'Opens in your browser — needs the network',
  nativeHint: 'Installed on this machine — works offline',
  updateAvailable: 'update available',
  log: 'Log',
  menu: 'Menu',
  stores: 'Stores',
  addStore: 'Add a store…',
  switchFailed: 'That store could not be opened',
  actions: 'Actions',
  categories: 'Categories',
  catAll: 'Everything',
  catInstalled: 'Installed',
  catUpdates: 'Updates',
  catAvailable: 'Not installed',
  catPlatform: 'Platform',
  catMode: 'Kind',
  language: 'Language',
  noGames: 'No installable titles in the catalog.',
  noMatch: 'Nothing in this category.',
  setupTitle: 'Set up a store',
  setupBody: 'No store on this machine yet. Pick one and it will be downloaded — the same files the shell installer would place, in the same folder.',
  setupAction: 'Download the store',
  setupWorking: 'Setting up…',
  setupChoose: 'Store',
  registryFailed: 'The list of stores could not be fetched',
  registryEmpty: 'The list of stores came back empty. Nothing to install from yet.',
  registryRetry: 'Try again',
  oldEngineTitle: 'The store needs refreshing',
  oldEngineBody: 'The store engine on this machine is older than this client can drive. Refreshing it downloads the current engine and keeps your settings and installed games.',
  oldEngineAction: 'Refresh the store',
  noPythonTitle: 'Python 3 is required',
  noPythonBody: 'The store is a Python program, so Python 3 has to be installed. Install it, then reopen this window.',
  pythonLink: 'python.org/downloads',
  paths: 'Where things go',
  openStoreFolder: 'Open the store folder',
  openMenuFolder: 'Open the menu folder',
  busy: 'Working…',
  failed: 'failed',
  removed: 'removed',
  upToDate: 'Everything is up to date.',
  of: 'of'
} as const

/** Every string the window can show, by key. */
export type MessageKey = keyof typeof ENGLISH_MESSAGES
