'use strict'
// The whole renderer. No framework and no build step: the app is a grid of
// cards, and every action is one call over the bridge in preload.js.

const api = window.storeApi
const el = (id) => document.getElementById(id)

let T = {}                 // the active string table
let games = []
let paths = null
let busy = false
let plan = null            // { total, done } while a sync is running

// --- helpers --------------------------------------------------------------

function text (node, value) {
  node.textContent = value == null ? '' : String(value)
}

function imageUrl (game) {
  if (!game.image_url) return null
  if (/^https?:\/\//.test(game.image_url)) return game.image_url
  const base = (paths && paths.store && paths.store.base_url) || ''
  return base ? `${base}${game.image_url}` : null
}

function logLine (line) {
  const box = el('log-lines')
  const row = document.createElement('div')
  row.className = 'log-line'
  text(row, line)
  box.appendChild(row)
  while (box.childElementCount > 400) box.removeChild(box.firstChild)
  box.scrollTop = box.scrollHeight
}

function setBusy (value) {
  busy = value
  for (const node of document.querySelectorAll('button')) {
    if (node.id === 'log-toggle') continue
    node.disabled = value
  }
  const progress = el('progress')
  if (!value) {
    progress.hidden = true
    plan = null
  }
}

function showProgress (label) {
  const progress = el('progress')
  progress.hidden = false
  text(progress, label)
}

// --- the card grid --------------------------------------------------------

function card (game) {
  const node = document.createElement('article')
  node.className = 'card'
  if (game.installed) node.classList.add('is-installed')

  const art = document.createElement('div')
  art.className = 'art'
  const src = imageUrl(game)
  if (src) {
    const img = document.createElement('img')
    img.src = src
    img.alt = ''
    img.loading = 'lazy'
    art.appendChild(img)
  } else {
    const glyph = document.createElement('span')
    glyph.className = 'art-glyph'
    text(glyph, game.title.slice(0, 1).toUpperCase())
    art.appendChild(glyph)
  }
  node.appendChild(art)

  const body = document.createElement('div')
  body.className = 'body'

  const title = document.createElement('h2')
  text(title, game.title)
  body.appendChild(title)

  const meta = document.createElement('div')
  meta.className = 'meta'
  const mode = document.createElement('span')
  mode.className = `badge badge-${game.mode}`
  text(mode, game.mode === 'web' ? T.hosted : T.native)
  mode.title = game.mode === 'web' ? T.hostedHint : T.nativeHint
  meta.appendChild(mode)
  const platform = document.createElement('span')
  platform.className = 'badge badge-plain'
  text(platform, game.platform)
  meta.appendChild(platform)
  const version = document.createElement('span')
  version.className = 'version'
  text(version, game.installed && game.installed_version
    ? `${game.installed_version} · ${T.installed}`
    : game.version)
  meta.appendChild(version)
  body.appendChild(meta)

  if (game.desc) {
    const desc = document.createElement('p')
    desc.className = 'desc'
    text(desc, game.desc)
    body.appendChild(desc)
  }

  const actions = document.createElement('div')
  actions.className = 'actions'

  if (game.installed && !game.update_available) {
    const play = document.createElement('button')
    play.className = 'btn btn-primary'
    text(play, game.mode === 'web' ? T.open : T.play)
    play.addEventListener('click', () => api.launch(game))
    actions.appendChild(play)
  } else {
    const install = document.createElement('button')
    install.className = 'btn btn-primary'
    text(install, game.update_available ? T.update : T.install)
    install.addEventListener('click', () => runSync([game.name]))
    actions.appendChild(install)
  }

  if (game.installed) {
    const remove = document.createElement('button')
    remove.className = 'btn btn-ghost'
    text(remove, T.remove)
    remove.addEventListener('click', () => runRemove(game.name))
    actions.appendChild(remove)
  }

  body.appendChild(actions)
  node.appendChild(body)
  return node
}

function renderGrid () {
  const grid = el('grid')
  grid.replaceChildren(...games.map(card))
  grid.hidden = games.length === 0
  const empty = el('empty')
  empty.hidden = games.length !== 0
  text(empty, T.noGames)
}

function renderPaths () {
  const box = el('log-paths')
  box.replaceChildren()
  if (!paths) return
  const line = document.createElement('div')
  line.className = 'paths-line'
  text(line, `${T.paths}: ${paths.store_folder} · ${paths.menu_group}`)
  box.appendChild(line)

  for (const [label, dir] of [[T.openStoreFolder, paths.store_folder],
                              [T.openMenuFolder, paths.menu_group]]) {
    const button = document.createElement('button')
    button.className = 'btn btn-tiny'
    text(button, label)
    button.addEventListener('click', () => api.openFolder(dir))
    box.appendChild(button)
  }
}

// --- actions --------------------------------------------------------------

async function refresh () {
  try {
    const result = await api.list()
    games = result.games || []
    paths = result.paths || paths
    renderGrid()
    renderPaths()
    for (const reason of result.skipped || []) logLine(`skipped ${reason}`)
  } catch (err) {
    logLine(String(err && err.message ? err.message : err))
  }
}

async function runSync (names) {
  try {
    await api.sync(names || [])
  } catch (err) {
    logLine(String(err && err.message ? err.message : err))
  }
  await refresh()
}

async function runRemove (name) {
  try {
    await api.remove(name)
  } catch (err) {
    logLine(String(err && err.message ? err.message : err))
  }
  await refresh()
}

// --- gate: no python, or no store yet -------------------------------------

function showGate (title, body, action, link) {
  el('grid').hidden = true
  el('empty').hidden = true
  const gate = el('gate')
  gate.hidden = false
  text(el('gate-title'), title)
  text(el('gate-body'), body)
  const button = el('gate-action')
  button.hidden = !action
  if (action) {
    text(button, action.label)
    button.onclick = action.onClick
  }
  const anchor = el('gate-link')
  anchor.hidden = !link
  if (link) {
    text(anchor, link.label)
    anchor.onclick = (event) => { event.preventDefault(); api.openExternal(link.url) }
  }
}

function hideGate () {
  el('gate').hidden = true
}

// --- boot -----------------------------------------------------------------

function applyStrings (strings) {
  T = strings
  text(el('app-name'), T.appName)
  text(el('sync-all'), T.syncAll)
  text(el('refresh'), T.refresh)
  text(el('log-toggle'), T.log)
  renderPaths()
  if (games.length) renderGrid()
}

async function boot () {
  const state = await api.state()
  applyStrings(state.strings)

  const select = el('locale')
  select.replaceChildren(...state.languages.map((code) => {
    const option = document.createElement('option')
    option.value = code
    option.textContent = code.toUpperCase()
    if (code === state.locale) option.selected = true
    return option
  }))
  select.addEventListener('change', async () => {
    const next = await api.setLocale(select.value)
    applyStrings(next.strings)
  })

  if (!state.python) {
    showGate(T.noPythonTitle, T.noPythonBody, null,
      { label: T.pythonLink, url: 'https://www.python.org/downloads/' })
    return
  }

  const setUpStore = async () => {
    showProgress(T.setupWorking)
    try {
      await api.bootstrap()
      hideGate()
      await refresh()
    } catch (err) {
      logLine(String(err && err.message ? err.message : err))
    }
  }

  if (!state.store) {
    showGate(T.setupTitle, `${T.setupBody}\n\n${state.defaultHome}`,
      { label: T.setupAction, onClick: async () => { await setUpStore(); await runSync([]) } })
    return
  }

  if (state.engine && !state.engine.ok) {
    showGate(T.oldEngineTitle,
      `${T.oldEngineBody}\n\n${state.engine.text} → ${state.minEngine}`,
      { label: T.oldEngineAction, onClick: setUpStore })
    return
  }

  text(el('store-id'), state.store.id)
  hideGate()
  await refresh()
}

el('sync-all').addEventListener('click', () => runSync([]))
el('refresh').addEventListener('click', () => refresh())
el('log-toggle').addEventListener('click', () => {
  const box = el('log-lines')
  box.hidden = !box.hidden
  el('log-toggle').setAttribute('aria-expanded', String(!box.hidden))
})

api.onLog(logLine)
api.onBusy(setBusy)
api.onEvent((event) => {
  if (event.event === 'plan') {
    plan = { total: event.count, done: 0 }
    showProgress(`0 ${T.of} ${event.count}`)
  } else if (event.event === 'begin' && plan) {
    showProgress(`${plan.done + 1} ${T.of} ${plan.total} · ${event.title}`)
  } else if (event.event === 'installed' && plan) {
    plan.done += 1
    logLine(`${event.title} — ${event.changed ? T.installed : T.upToDate}`)
  } else if (event.event === 'failed') {
    logLine(`${event.name}: ${T.failed} — ${event.error}`)
  } else if (event.event === 'removed') {
    logLine(`${event.name} — ${T.removed}`)
  }
})

boot()
