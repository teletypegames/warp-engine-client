/**
 * The English message bundle, and the source of the key set.
 *
 * Every other language is typed against these keys, so a missing or misspelled
 * translation is a compile error rather than a blank label at runtime.
 */
export const ENGLISH_MESSAGES = {
  appName: 'WarpEngine Client',
  refresh: 'Refresh the catalog',
  install: 'Install',
  upgrade: 'Upgrade',
  play: 'Play',
  open: 'Open',
  uninstall: 'Uninstall',
  moreActions: 'More actions',
  installed: 'installed',
  native: 'native',
  hosted: 'hosted',
  hostedHint: 'Opens in your browser — needs the network',
  nativeHint: 'Installed on this machine — works offline',
  updateAvailable: 'update available',
  unsupportedPlatform: 'unsupported platform',
  unsupportedBuild: 'no build for this machine',
  log: 'Log',
  menu: 'Menu',
  stores: 'Stores',
  addStore: 'Add a store…',
  switchFailed: 'That store could not be opened',
  categories: 'Categories',
  catAll: 'Everything',
  catInstalled: 'Installed',
  catUpdates: 'Updates',
  catAvailable: 'Not installed',
  catUnsupported: 'Not for this machine',
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
