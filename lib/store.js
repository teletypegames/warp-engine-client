'use strict'
// The bridge to the store CLI.
//
// The CLI is the product; this file only finds it and talks to it. Every
// operation is `desktop_store.py --json …`, which puts data on stdout and its
// log on stderr — so nothing here parses a sentence meant for a person.
//
// Shaped for more than one engine on purpose: ENGINES is a list today with one
// entry, and the RetroArch store could be added without touching the callers.

const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ENGINES = [
  {
    id: 'desktop',
    script: 'desktop_store.py',
    // The installer names the store home `<store id>-desktop`, so the RetroArch
    // engine can share the same root without sharing config.json and state.json.
    homeSuffix: '-desktop',
    launcherSuffix: '-desktop-store'
  }
]

/** The roots the shell installers use, in the same order they would. */
function storeRoots () {
  const home = os.homedir()
  const roots = []
  if (process.env.STORE_ROOT) roots.push(process.env.STORE_ROOT)
  if (process.env.XDG_DATA_HOME) {
    roots.push(path.join(process.env.XDG_DATA_HOME, 'warp-engine-store'))
  }
  roots.push(path.join(home, '.local', 'share', 'warp-engine-store'))
  if (process.platform === 'darwin') {
    roots.push(path.join(home, 'Library', 'Application Support', 'warp-engine-store'))
  }
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    roots.push(path.join(process.env.LOCALAPPDATA, 'warp-engine-store'))
  }
  return [...new Set(roots)]
}

/** Every installed store this client can drive. */
function findStores () {
  const found = []
  for (const root of storeRoots()) {
    let entries = []
    try {
      entries = fs.readdirSync(root, { withFileTypes: true })
    } catch { continue }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const home = path.join(root, entry.name)
      for (const engine of ENGINES) {
        const script = path.join(home, engine.script)
        const config = path.join(home, 'config.json')
        if (fs.existsSync(script) && fs.existsSync(config)) {
          found.push({ engine: engine.id, id: entry.name.replace(engine.homeSuffix, ''), home, script, config })
        }
      }
    }
  }
  return found
}

function findStore () {
  return findStores()[0] || null
}

/** Where a store would be installed if there is none yet. */
function defaultHome (storeId = 'ttg') {
  const engine = ENGINES[0]
  return path.join(storeRoots()[0], `${storeId}${engine.homeSuffix}`)
}

// Python 3 is what the CLI needs, and its name differs per platform. `py -3` is
// the Windows launcher, which is often the only one on PATH.
const PYTHON_CANDIDATES = process.platform === 'win32'
  ? [['py', ['-3']], ['python', []], ['python3', []]]
  : [['python3', []], ['python', []]]

let cachedPython = null

function findPython () {
  if (cachedPython !== undefined && cachedPython !== null) return cachedPython
  for (const [cmd, args] of PYTHON_CANDIDATES) {
    try {
      const probe = spawnSync(cmd, [...args, '--version'], { encoding: 'utf8', timeout: 10000 })
      const out = `${probe.stdout || ''}${probe.stderr || ''}`
      if (probe.status === 0 && /Python 3\./.test(out)) {
        cachedPython = { cmd, args, version: out.trim() }
        return cachedPython
      }
    } catch { /* try the next one */ }
  }
  cachedPython = null
  return null
}

class StoreError extends Error {
  constructor (message, code) {
    super(message)
    this.code = code
  }
}

// The oldest engine that speaks `--json`. An older one is not broken, it simply
// cannot be driven from a window — and it will be met in the wild, because the
// CLI shipped before this client did.
const MIN_ENGINE = [1, 1, 0]

function parseVersion (text) {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(String(text || ''))
  return match ? match.slice(1, 4).map(Number) : null
}

function atLeast (version, minimum) {
  if (!version) return false
  for (let i = 0; i < minimum.length; i += 1) {
    if ((version[i] || 0) > minimum[i]) return true
    if ((version[i] || 0) < minimum[i]) return false
  }
  return true
}

/** The installed engine's version string, and whether this client can drive it. */
function engineVersion (store) {
  const python = findPython()
  if (!python || !store) return null
  try {
    const probe = spawnSync(python.cmd, [...python.args, store.script, '--version'],
      { encoding: 'utf8', timeout: 15000 })
    const text = `${probe.stdout || ''}${probe.stderr || ''}`.trim()
    if (probe.status !== 0 || !text) return null
    return { text, version: parseVersion(text), ok: atLeast(parseVersion(text), MIN_ENGINE) }
  } catch {
    return null
  }
}

/**
 * Run one CLI command.
 *
 * `onLine` gets every stdout line already parsed (the CLI emits one JSON object
 * per line), `onLog` every stderr line as text. Resolves with the parsed lines.
 */
function run (store, args, { onLine, onLog, signal } = {}) {
  const python = findPython()
  if (!python) throw new StoreError('python3 was not found on this machine', 'NO_PYTHON')
  if (!store) throw new StoreError('no store is installed yet', 'NO_STORE')

  const argv = [...python.args, store.script, '--config', store.config, '--json', ...args]
  return new Promise((resolve, reject) => {
    const child = spawn(python.cmd, argv, {
      env: { ...process.env, DESKTOP_STORE_HOME: store.home },
      signal
    })
    const lines = []
    let stdoutRest = ''
    let stderrRest = ''

    const takeStdout = (chunk) => {
      stdoutRest += chunk
      const parts = stdoutRest.split('\n')
      stdoutRest = parts.pop()
      for (const part of parts) {
        if (!part.trim()) continue
        let value
        try {
          value = JSON.parse(part)
        } catch {
          // Not ours to interpret — hand it on as a log line rather than crash.
          if (onLog) onLog(part)
          continue
        }
        lines.push(value)
        if (onLine) onLine(value)
      }
    }
    const takeStderr = (chunk) => {
      stderrRest += chunk
      const parts = stderrRest.split('\n')
      stderrRest = parts.pop()
      for (const part of parts) if (part.trim() && onLog) onLog(part)
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', takeStdout)
    child.stderr.on('data', takeStderr)
    child.on('error', (err) => reject(new StoreError(err.message, 'SPAWN_FAILED')))
    child.on('close', (code) => {
      takeStdout('\n')
      takeStderr('\n')
      if (code === 0) resolve(lines)
      else reject(new StoreError(`the store exited with code ${code}`, 'CLI_FAILED'))
    })
  })
}

async function list (store, hooks) {
  const lines = await run(store, ['list'], hooks)
  return lines[lines.length - 1] || { games: [], skipped: [] }
}

async function paths (store, hooks) {
  const lines = await run(store, ['paths'], hooks)
  return lines[lines.length - 1] || {}
}

function sync (store, names = [], hooks) {
  return run(store, ['sync', ...names], hooks)
}

function remove (store, name, hooks) {
  return run(store, ['remove', name], hooks)
}

function purge (store, hooks) {
  return run(store, ['purge'], hooks)
}

module.exports = {
  ENGINES, MIN_ENGINE, StoreError, atLeast, defaultHome, engineVersion, findPython,
  findStore, findStores, list, parseVersion, paths, purge, remove, run, storeRoots, sync
}
