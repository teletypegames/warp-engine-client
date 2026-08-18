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
    appName: document.getElementById('app-name').textContent,
    storeId: document.getElementById('store-id').textContent,
    paths: document.getElementById('log-paths').textContent.slice(0, 120),
    logLines: document.querySelectorAll('.log-line').length,
    locales: [...document.getElementById('locale').options].map((o) => o.value)
  }))()`)
  console.log(JSON.stringify(result, null, 2))
  const good = result.cards > 0 && !result.gateVisible && result.locales.length > 1
  console.log(good ? 'SELFTEST OK' : 'SELFTEST FAILED')
  app.exit(good ? 0 : 1)
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
  current = store.findStore()
  // An engine that predates `--json` cannot be driven from a window; the client
  // says so and offers to refresh it rather than failing on the first call.
  const engine = current ? store.engineVersion(current) : null
  return {
    locale: i18n.pick(prefs.locale || app.getLocale()),
    languages: i18n.languages,
    strings: i18n.dict(prefs.locale || app.getLocale()),
    python: python ? python.version : null,
    store: current ? { id: current.id, home: current.home } : null,
    engine: engine ? { text: engine.text, ok: engine.ok } : null,
    minEngine: store.MIN_ENGINE.join('.'),
    defaultHome: store.defaultHome(),
    version: app.getVersion()
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

ipcMain.handle('store:bootstrap', () => guarded(async () => {
  const home = store.defaultHome()
  const result = await bootstrap.install(home, { onLog: (line) => send('store:log', line) })
  current = { engine: 'desktop', id: path.basename(home).replace(/-desktop$/, ''), ...result }
  return { id: current.id, home: current.home }
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
