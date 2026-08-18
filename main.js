'use strict'
// Main process: one window, and the IPC that lets it drive the store CLI.
//
// The renderer gets no Node access at all (contextIsolation on, nodeIntegration
// off, sandbox on); everything it can do is in preload.js and handled here.

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')

const store = require('./lib/store')
const bootstrap = require('./lib/bootstrap')
const i18n = require('./lib/i18n')

let win = null
let current = null          // the store we are driving
let busy = false            // one CLI call at a time
const prefsFile = () => path.join(app.getPath('userData'), 'prefs.json')

function loadPrefs () {
  try {
    return JSON.parse(fs.readFileSync(prefsFile(), 'utf8'))
  } catch {
    return {}
  }
}

function savePrefs (prefs) {
  try {
    fs.mkdirSync(path.dirname(prefsFile()), { recursive: true })
    fs.writeFileSync(prefsFile(), JSON.stringify(prefs, null, 2))
  } catch { /* a lost preference is not worth an error dialog */ }
}

function send (channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

const hooks = () => ({
  onLog: (line) => send('store:log', line),
  onLine: (event) => send('store:event', event)
})

/** One CLI call at a time: the store writes files, and two writers would race. */
async function guarded (fn) {
  if (busy) throw new Error('busy')
  busy = true
  send('store:busy', true)
  try {
    return await fn()
  } finally {
    busy = false
    send('store:busy', false)
  }
}

// `--selftest` drives the window once and reports what rendered, so the UI has a
// check that does not need a pair of eyes. It is the only way a renderer error
// would otherwise be noticed: the main process log stays empty.
const SELFTEST = process.argv.includes('--selftest')

// A test run must never be swallowed by a copy the user already has open: it gets
// its own user-data directory and skips the single-instance lock. Without this the
// second process exits silently with status 0, which reads as a passing test.
if (SELFTEST) {
  app.setPath('userData', path.join(app.getPath('temp'), 'warpstore-gui-selftest'))
}

async function selftest () {
  const result = await win.webContents.executeJavaScript(`(() => ({
    cards: document.querySelectorAll('.card').length,
    installed: document.querySelectorAll('.card.is-installed').length,
    buttons: document.querySelectorAll('.card .actions button').length,
    gateVisible: !document.getElementById('gate').hidden,
    gateTitle: document.getElementById('gate-title').textContent,
    gateChoices: [...document.getElementById('gate-select').options].map((o) => o.text),
    gateAction: document.getElementById('gate-action').textContent,
    appName: document.getElementById('app-name').textContent,
    storeId: document.getElementById('store-id').textContent,
    navOpen: !document.body.classList.contains('nav-closed'),
    stores: [...document.querySelectorAll('#store-list .store-row')].map((n) => n.textContent),
    categories: [...document.querySelectorAll('#cats .cat')].map((n) => n.textContent),
    activeCategory: (document.querySelector('#cats .cat.is-active') || {}).textContent || null,
    paths: document.getElementById('log-paths').textContent.slice(0, 120),
    logLines: document.querySelectorAll('.log-line').length,
    locales: [...document.getElementById('locale').options].map((o) => o.value)
  }))()`)
  console.log(JSON.stringify(result, null, 2))

  // With two stores on the machine the switcher is the thing most likely to be
  // broken without anyone noticing, so the test uses it: click the store that is
  // not open and see whether the window follows. Skipped when there is only one,
  // which is the normal case — a single store cannot be switched away from.
  let switched = null
  if (result.stores.length > 1) {
    switched = await win.webContents.executeJavaScript(`(async () => {
      const other = [...document.querySelectorAll('#store-list .store-row')]
        .find((row) => !row.classList.contains('is-active'))
      other.click()
      await new Promise((done) => setTimeout(done, 8000))
      return {
        storeId: document.getElementById('store-id').textContent,
        active: (document.querySelector('#store-list .store-row.is-active') || {}).textContent || null,
        cards: document.querySelectorAll('.card').length,
        categories: document.querySelectorAll('#cats .cat').length
      }
    })()`)
    console.log(`switched: ${JSON.stringify(switched)}`)
  }

  // A layout mistake does not show up in the DOM counts above, so on request the
  // window photographs itself — the terminal cannot screenshot it from outside.
  if (process.env.SELFTEST_SHOT) {
    // capturePage hands back the last painted frame, so a window that is behind
    // others — or still loading box art — photographs as a half-drawn page. Focus
    // it, wait for the images, then let one frame go by.
    win.show()
    win.focus()
    await win.webContents.executeJavaScript(`(async () => {
      await Promise.all([...document.images].map((img) => img.complete
        ? null
        : new Promise((done) => { img.onload = done; img.onerror = done })))
      await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 400)))
      return document.images.length
    })()`)
    const image = await win.webContents.capturePage()
    fs.writeFileSync(process.env.SELFTEST_SHOT, image.toPNG())
    console.log(`shot: ${process.env.SELFTEST_SHOT}`)
  }

  // Either outcome is a pass: a grid when a store is installed — with the side
  // menu populated, which is the part a blank render would silently lose — or the
  // setup gate with something to choose from when there is none.
  const good = result.locales.length > 1 && (
    (result.cards > 0 && !result.gateVisible &&
      result.stores.length > 0 && result.categories.length > 0 && result.activeCategory) ||
    (result.gateVisible && result.gateChoices.length > 0 && result.gateAction))
  const switchGood = switched === null || (
    switched.storeId && switched.storeId !== result.storeId &&
    switched.cards > 0 && switched.categories > 0)
  console.log(good && switchGood ? 'SELFTEST OK' : 'SELFTEST FAILED')
  app.exit(good && switchGood ? 0 : 1)
}

function createWindow () {
  win = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: '#11151c',
    title: 'WarpEngine Store',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  // A renderer error is invisible from here otherwise.
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2 || SELFTEST) console.log(`[renderer] ${message}`)
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    console.log(`[renderer] gone: ${details.reason}`)
    if (SELFTEST) app.exit(1)
  })
  if (SELFTEST) {
    // The first list() has to finish before there is anything to look at.
    win.webContents.once('did-finish-load', () => setTimeout(() => {
      selftest().catch((err) => { console.log(`SELFTEST ERROR ${err.message}`); app.exit(1) })
    }, 6000))
  }

  // Nothing in this app should ever navigate away or open a second window; a
  // link the user clicks goes to their browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault()
      if (/^https:\/\//.test(url)) shell.openExternal(url)
    }
  })
}

// --- IPC ------------------------------------------------------------------

ipcMain.handle('app:state', () => {
  const prefs = loadPrefs()
  const python = store.findPython()
  // Every store on the machine, because the window offers a switch between them —
  // and the remembered one wins, so reopening lands where the user left off.
  const stores = store.findStores()
  current = store.findStore(prefs.store)
  // An engine that predates `--json` cannot be driven from a window; the client
  // says so and offers to refresh it rather than failing on the first call.
  const engine = current ? store.engineVersion(current) : null
  return {
    locale: i18n.pick(prefs.locale || app.getLocale()),
    languages: i18n.languages,
    strings: i18n.dict(prefs.locale || app.getLocale()),
    nav: prefs.nav !== false,
    python: python ? python.version : null,
    store: store.describe(current),
    stores: stores.map(store.describe),
    engine: engine ? { text: engine.text, ok: engine.ok } : null,
    minEngine: store.MIN_ENGINE.join('.'),
    registryUrl: bootstrap.REGISTRY_URL,
    storeRoot: store.storeRoots()[0],
    version: app.getVersion()
  }
})

// The side menu's open/closed state is worth keeping between runs; it is the one
// preference the window sets that is not a language.
ipcMain.handle('app:setNav', (_event, open) => {
  const prefs = loadPrefs()
  prefs.nav = Boolean(open)
  savePrefs(prefs)
  return prefs.nav
})

/**
 * Switch to another installed store.
 *
 * The choice is remembered, and the engine is checked here rather than in the
 * window: two stores on one machine can be at different versions, and the one
 * being switched to may be the older one.
 */
ipcMain.handle('store:use', (_event, home) => {
  const wanted = store.findStores().find((candidate) => candidate.home === home)
  if (!wanted) throw new Error('that store is no longer on this machine')
  current = wanted
  const prefs = loadPrefs()
  prefs.store = wanted.home
  savePrefs(prefs)
  const engine = store.engineVersion(current)
  return {
    store: store.describe(current),
    engine: engine ? { text: engine.text, ok: engine.ok } : null
  }
})

ipcMain.handle('app:setLocale', (_event, locale) => {
  const prefs = loadPrefs()
  prefs.locale = i18n.pick(locale)
  savePrefs(prefs)
  return { locale: prefs.locale, strings: i18n.dict(prefs.locale) }
})

ipcMain.handle('store:list', () => guarded(() => store.list(current, hooks())))
ipcMain.handle('store:paths', () => guarded(() => store.paths(current, hooks())))

ipcMain.handle('store:sync', (_event, names) =>
  guarded(() => store.sync(current, Array.isArray(names) ? names : [], hooks())))

ipcMain.handle('store:remove', (_event, name) =>
  guarded(() => store.remove(current, String(name), hooks())))

// The stores this client can install, from the site's registry rather than from
// anything baked in here. A separate call because it needs the network: the first
// window paints without waiting for it.
ipcMain.handle('store:registry', async () => {
  try {
    return { stores: await bootstrap.registry() }
  } catch (err) {
    return { stores: [], error: err.message, url: bootstrap.REGISTRY_URL }
  }
})

ipcMain.handle('store:bootstrap', (_event, chosen) => guarded(async () => {
  if (!chosen) throw new Error('no store was chosen')
  const home = bootstrap.homeFor(chosen, store.storeRoots()[0])
  const result = await bootstrap.install(home, chosen, { onLog: (line) => send('store:log', line) })
  current = { engine: 'desktop', ...result }
  const prefs = loadPrefs()
  prefs.store = current.home
  savePrefs(prefs)
  return { ...store.describe(current), name: chosen.name }
}))

/**
 * Launch what was installed.
 *
 * A hosted title is a URL, so it goes to the browser. A native one is whatever
 * the store recorded: on macOS the app bundle through `open`, elsewhere the
 * executable from its own directory — the same working directory the menu entry
 * uses, because games load their assets relative to it.
 */
ipcMain.handle('store:launch', async (_event, game) => {
  if (!game) return false
  if (game.mode === 'web' && game.url) {
    await shell.openExternal(game.url)
    return true
  }
  const target = game.menu_entry || game.exe
  if (!target || !fs.existsSync(target)) return false
  if (process.platform === 'darwin' && target.endsWith('.app')) {
    spawn('open', [target], { detached: true, stdio: 'ignore' }).unref()
    return true
  }
  if (process.platform === 'win32' || target.endsWith('.desktop')) {
    const error = await shell.openPath(target)
    if (!error) return true
  }
  const exe = game.exe || target
  spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore' }).unref()
  return true
})

ipcMain.handle('app:openFolder', async (_event, dir) => {
  if (!dir) return false
  const error = await shell.openPath(dir)
  return !error
})

ipcMain.handle('app:openExternal', async (_event, url) => {
  if (!/^https:\/\//.test(String(url))) return false
  await shell.openExternal(String(url))
  return true
})

// --- lifecycle ------------------------------------------------------------

if (!SELFTEST && !app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  process.on('unhandledRejection', (reason) => {
    dialog.showErrorBox('WarpEngine Store', String(reason && reason.message ? reason.message : reason))
  })
}
