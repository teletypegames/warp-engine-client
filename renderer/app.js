'use strict'
// The whole renderer. No framework and no build step: a side menu on the left
// decides what is shown, a grid of cards on the right shows it, and every action
// is one call over the bridge in preload.js.

const api = window.storeApi
const el = (id) => document.getElementById(id)

let T = {}                 // the active string table
let state = null           // what the main process knows: stores, python, engine
let games = []
let paths = null
let busy = false
let plan = null            // { total, done } while a sync is running

// What the grid is narrowed down to. One category at a time on purpose: a matrix
// of filters would need explaining, and a catalog of this size does not earn it.
let filter = { kind: 'group', value: 'all' }

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

// While the CLI runs, anything that would start a second call is disabled. The
// menu toggle, the log drawer and the category filters are not among them: they
// only change what is on screen.
function setBusy (value) {
  busy = value
  for (const node of document.querySelectorAll('button')) {
    if (node.id === 'log-toggle' || node.id === 'nav-toggle') continue
    if (node.classList.contains('cat')) continue
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

// --- the side menu --------------------------------------------------------

function setNav (open) {
  document.body.classList.toggle('nav-closed', !open)
  el('nav-toggle').setAttribute('aria-expanded', String(open))
}

function renderStores () {
  const box = el('store-list')
  const stores = (state && state.stores) || []
  const active = state && state.store ? state.store.home : null
  // Two stores can carry the same id in different roots — the same catalog
  // installed twice. Then the id says nothing and the folder is what tells them
  // apart, so that is what the row shows.
  const ambiguous = new Set(stores
    .filter((store, index) => stores.findIndex((other) => other.id === store.id) !== index)
    .map((store) => store.id))
  box.replaceChildren(...stores.map((store) => {
    const row = document.createElement('button')
    row.className = 'store-row'
    if (store.home === active) row.classList.add('is-active')
    const name = document.createElement('span')
    name.className = 'store-row-name'
    text(name, store.name)
    row.appendChild(name)
    const id = document.createElement('span')
    id.className = 'store-row-id'
    text(id, ambiguous.has(store.id) ? store.home : store.id)
    row.appendChild(id)
    row.title = store.home
    row.addEventListener('click', () => {
      if (store.home !== active) switchStore(store.home)
    })
    return row
  }))
  el('add-store').hidden = false
}

/**
 * The categories, built from what the catalog actually contains.
 *
 * There is no genre in a WarpEngine catalog, so the useful axes are the state of
 * a title on this machine, the platform it was built with, and whether it runs
 * here or in a browser. Empty axes are left out rather than shown as zeroes.
 */
function categories () {
  const count = (fn) => games.filter(fn).length
  const sections = [{
    group: null,
    items: [
      { kind: 'group', value: 'all', label: T.catAll, count: games.length },
      { kind: 'group', value: 'installed', label: T.catInstalled, count: count((g) => g.installed) },
      { kind: 'group', value: 'updates', label: T.catUpdates, count: count((g) => g.update_available) },
      { kind: 'group', value: 'available', label: T.catAvailable, count: count((g) => !g.installed) }
    ].filter((item) => item.value === 'all' || item.count > 0)
  }]

  const platforms = [...new Set(games.map((g) => g.platform).filter(Boolean))].sort()
  if (platforms.length > 1) {
    sections.push({
      group: T.catPlatform,
      items: platforms.map((platform) => ({
        kind: 'platform', value: platform, label: platform, count: count((g) => g.platform === platform)
      }))
    })
  }

  const modes = [...new Set(games.map((g) => g.mode).filter(Boolean))]
  if (modes.length > 1) {
    sections.push({
      group: T.catMode,
      items: modes.map((mode) => ({
        kind: 'mode', value: mode, label: mode === 'web' ? T.hosted : T.native, count: count((g) => g.mode === mode)
      }))
    })
  }
  return sections
}

function matches (game) {
  if (filter.kind === 'platform') return game.platform === filter.value
  if (filter.kind === 'mode') return game.mode === filter.value
  if (filter.value === 'installed') return Boolean(game.installed)
  if (filter.value === 'updates') return Boolean(game.update_available)
  if (filter.value === 'available') return !game.installed
  return true
}

function renderCats () {
  const box = el('cats')
  const sections = categories()

  // A category can vanish under us — the last title of a platform is removed, or
  // an update is applied — and a filter matching nothing would look like an empty
  // catalog. Falling back to everything is the honest answer.
  const known = sections.flatMap((section) => section.items)
    .some((item) => item.kind === filter.kind && item.value === filter.value)
  if (!known) filter = { kind: 'group', value: 'all' }

  const nodes = []
  for (const section of sections) {
    if (section.group) {
      const head = document.createElement('div')
      head.className = 'cat-group'
      text(head, section.group)
      nodes.push(head)
    }
    for (const item of section.items) {
      const button = document.createElement('button')
      button.className = 'cat'
      if (item.kind === filter.kind && item.value === filter.value) button.classList.add('is-active')
      const label = document.createElement('span')
      label.className = 'cat-label'
      text(label, item.label)
      button.appendChild(label)
      const count = document.createElement('span')
      count.className = 'cat-count'
      text(count, item.count)
      button.appendChild(count)
      button.addEventListener('click', () => {
        filter = { kind: item.kind, value: item.value }
        renderCats()
        renderGrid()
      })
      nodes.push(button)
    }
  }
  box.replaceChildren(...nodes)
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
    // No box art in the catalog: the first letter, on the same band an image
    // would fill, so a row of cards stays aligned either way.
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
  const shown = games.filter(matches)
  const grid = el('grid')
  grid.replaceChildren(...shown.map(card))
  grid.hidden = shown.length === 0
  grid.scrollTop = 0
  const empty = el('empty')
  empty.hidden = shown.length !== 0
  text(empty, games.length === 0 ? T.noGames : T.noMatch)
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
    renderCats()
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

/** Open another store that is already on this machine. */
async function switchStore (home) {
  try {
    const next = await api.use(home)
    state.store = next.store
    state.engine = next.engine
    text(el('store-id'), next.store.id)
    renderStores()
    games = []
    paths = null
    filter = { kind: 'group', value: 'all' }
    if (next.engine && !next.engine.ok) {
      renderCats()
      showOldEngineGate()
      return
    }
    hideGate()
    await refresh()
  } catch (err) {
    logLine(`${T.switchFailed}: ${err && err.message ? err.message : err}`)
  }
}

/** Pick up a store that appeared since the window opened. */
async function reloadState () {
  state = await api.state()
  text(el('store-id'), state.store ? state.store.id : '')
  renderStores()
}

// --- gate: no python, no store yet, or an engine too old ------------------

function showGate (title, body, action, link, choices) {
  el('grid').hidden = true
  el('empty').hidden = true
  const gate = el('gate')
  gate.hidden = false
  text(el('gate-title'), title)
  text(el('gate-body'), body)

  // Only shown when the registry offers more than one store; with a single one
  // there is nothing to decide.
  const choice = el('gate-choice')
  const select = el('gate-select')
  choice.hidden = !choices || choices.length < 2
  if (!choice.hidden) {
    text(el('gate-choice-label'), T.setupChoose)
    select.replaceChildren(...choices.map((store, index) => {
      const option = document.createElement('option')
      option.value = String(index)
      option.textContent = store.name
      return option
    }))
  }

  const button = el('gate-action')
  button.hidden = !action
  if (action) {
    text(button, action.label)
    button.onclick = () => action.onClick(choices ? choices[Number(select.value) || 0] : undefined)
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

function showOldEngineGate () {
  showGate(T.oldEngineTitle,
    `${T.oldEngineBody}\n\n${state.engine.text} → ${state.minEngine}`,
    { label: T.oldEngineAction, onClick: offerStores })
}

async function setUpStore (chosen) {
  showProgress(T.setupWorking)
  try {
    await api.bootstrap(chosen)
    await reloadState()
    hideGate()
    await refresh()
  } catch (err) {
    logLine(String(err && err.message ? err.message : err))
  }
}

// Which stores exist is the site's answer, not this client's: the registry is
// asked for it, and its records carry the catalog and the config repository.
async function offerStores () {
  const result = await api.registry()
  if (result.error) {
    showGate(`${T.registryFailed}`, `${result.url}\n\n${result.error}`,
      { label: T.registryRetry, onClick: offerStores })
    return
  }
  if (!result.stores.length) {
    showGate(T.setupTitle, `${T.registryEmpty}\n\n${result.url}`, null)
    return
  }
  showGate(T.setupTitle,
    `${T.setupBody}\n\n${state.storeRoot}`,
    { label: T.setupAction, onClick: async (chosen) => { await setUpStore(chosen); await runSync([]) } },
    null,
    result.stores)
}

// --- boot -----------------------------------------------------------------

function applyStrings (strings) {
  T = strings
  text(el('app-name'), T.appName)
  text(el('sync-all'), T.syncAll)
  text(el('refresh'), T.refresh)
  text(el('log-toggle'), T.log)
  text(el('head-stores'), T.stores)
  text(el('head-actions'), T.actions)
  text(el('head-cats'), T.categories)
  text(el('head-lang'), T.language)
  text(el('add-store'), T.addStore)
  el('nav-toggle').title = T.menu
  el('nav-toggle').setAttribute('aria-label', T.menu)
  renderPaths()
  if (state) renderStores()
  if (games.length) {
    renderCats()
    renderGrid()
  }
}

async function boot () {
  state = await api.state()
  applyStrings(state.strings)
  setNav(state.nav !== false)
  renderStores()

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

  if (!state.store) {
    await offerStores()
    return
  }

  if (state.engine && !state.engine.ok) {
    showOldEngineGate()
    return
  }

  text(el('store-id'), state.store.id)
  hideGate()
  await refresh()
}

el('sync-all').addEventListener('click', () => runSync([]))
el('refresh').addEventListener('click', () => refresh())
el('add-store').addEventListener('click', () => offerStores())
el('nav-toggle').addEventListener('click', () => {
  const open = document.body.classList.contains('nav-closed')
  setNav(open)
  api.setNav(open)
})
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
