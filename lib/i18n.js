'use strict'
// Two languages, the way the public site has them. The CLI and the docs stay
// English; this is the one end-user surface where Hungarian matters.
//
// Catalog text — titles, descriptions — is never translated here: it arrives
// from the store as it was published.

const STRINGS = {
  en: {
    appName: 'WarpEngine Store',
    syncAll: 'Install all',
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
    noGames: 'No installable titles in the catalog.',
    setupTitle: 'Set up the store',
    setupBody: 'The store engine is not on this machine yet. It can be downloaded now — the same files the shell installer would place, in the same folder.',
    setupAction: 'Download the store',
    setupWorking: 'Setting up…',
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
  },
  hu: {
    appName: 'WarpEngine Store',
    syncAll: 'Mind telepítése',
    refresh: 'Frissítés',
    install: 'Telepítés',
    update: 'Frissítés',
    play: 'Indítás',
    open: 'Megnyitás',
    remove: 'Eltávolítás',
    installed: 'telepítve',
    native: 'natív',
    hosted: 'hosztolt',
    hostedHint: 'A böngészőben nyílik meg — internet kell hozzá',
    nativeHint: 'Erre a gépre telepítve — internet nélkül is megy',
    updateAvailable: 'frissítés elérhető',
    log: 'Napló',
    noGames: 'Nincs telepíthető cím a katalógusban.',
    setupTitle: 'A store beállítása',
    setupBody: 'A store motorja még nincs ezen a gépen. Most letölthető — ugyanazok a fájlok, ugyanabba a könyvtárba, ahová a shell-telepítő tenné.',
    setupAction: 'Store letöltése',
    setupWorking: 'Beállítás…',
    oldEngineTitle: 'A store frissítésre vár',
    oldEngineBody: 'A gépen lévő store-motor régebbi, mint amit ez a kliens vezérelni tud. A frissítés letölti a mostani motort, a beállításaid és a telepített játékok pedig megmaradnak.',
    oldEngineAction: 'Store frissítése',
    noPythonTitle: 'Python 3 kell hozzá',
    noPythonBody: 'A store egy Python program, tehát Python 3 kell a gépre. Telepítsd, majd nyisd meg újra ezt az ablakot.',
    pythonLink: 'python.org/downloads',
    paths: 'Hova kerül',
    openStoreFolder: 'Store könyvtár megnyitása',
    openMenuFolder: 'Menü könyvtár megnyitása',
    busy: 'Dolgozom…',
    failed: 'hiba',
    removed: 'eltávolítva',
    upToDate: 'Minden naprakész.',
    of: '/'
  }
}

const FALLBACK = 'en'

function pick (locale) {
  const short = String(locale || '').slice(0, 2).toLowerCase()
  return STRINGS[short] ? short : FALLBACK
}

function dict (locale) {
  return STRINGS[pick(locale)]
}

module.exports = { FALLBACK, STRINGS, dict, pick, languages: Object.keys(STRINGS) }
