#!/usr/bin/env node
'use strict'
// Drives the bridge without Electron: no window, no packaging, just the part
// that talks to the store. This is where an integration mistake shows up first,
// so it is the check to run after touching lib/store.js or the CLI.
//
//   npm run smoke                       the store installed on this machine
//   SMOKE_HOME=/path/to/store-home npm run smoke     a sandbox store

const path = require('node:path')
const fs = require('node:fs')
const store = require('../lib/store')
const bootstrap = require('../lib/bootstrap')
const i18n = require('../lib/i18n')

function ok (label, value) {
  console.log(`  ok    ${label}${value === undefined ? '' : `: ${value}`}`)
}
function bad (label, value) {
  console.log(`  FAIL  ${label}${value === undefined ? '' : `: ${value}`}`)
  process.exitCode = 1
}

async function main () {
  console.log('warp-engine-desktop-gui smoke test')

  const python = store.findPython()
  if (python) ok('python', python.version)
  else return bad('python', 'not found — the store cannot run')

  for (const lang of i18n.languages) {
    const dict = i18n.dict(lang)
    const missing = Object.keys(i18n.STRINGS[i18n.FALLBACK]).filter((k) => !dict[k])
    if (missing.length) bad(`strings:${lang}`, `missing ${missing.join(', ')}`)
    else ok(`strings:${lang}`, `${Object.keys(dict).length} keys`)
  }

  // The registry is what decides which stores exist, so it is checked before
  // anything that depends on one being installed.
  try {
    const stores = await bootstrap.registry()
    if (!stores.length) bad('registry', `${bootstrap.REGISTRY_URL} returned no stores`)
    else {
      ok('registry', `${stores.length} store(s) from ${bootstrap.REGISTRY_URL}`)
      for (const store of stores) {
        ok(`  ${store.name}`, `${store.catalogUrl} · ${bootstrap.storeId(store)}`)
        const url = bootstrap.configUrl(store.storeRepositoryUrl)
        try {
          const config = JSON.parse(await bootstrap.fetchText(url))
          ok('  config.json', `${Object.keys(config).length} sections`)
        } catch (err) {
          // Not fatal: the engine merges onto its defaults, so a store without a
          // config file still installs.
          ok('  config.json', `absent (${err.statusCode || err.message}) — defaults would be used`)
        }
      }
    }
  } catch (err) {
    bad('registry', `${bootstrap.REGISTRY_URL}: ${err.message}`)
  }

  let target = null
  if (process.env.SMOKE_HOME) {
    const home = path.resolve(process.env.SMOKE_HOME)
    target = {
      engine: 'desktop',
      id: path.basename(home).replace(/-desktop$/, ''),
      home,
      script: path.join(home, 'desktop_store.py'),
      config: path.join(home, 'config.json')
    }
    for (const file of [target.script, target.config]) {
      if (!fs.existsSync(file)) return bad('SMOKE_HOME', `${file} is missing`)
    }
    ok('store (SMOKE_HOME)', target.home)
  } else {
    const stores = store.findStores()
    if (!stores.length) {
      console.log('  skip  no store installed — run the app once, or set SMOKE_HOME')
      console.log(`        it would be installed in ${store.defaultHome()}`)
      return
    }
    target = stores[0]
    ok('store found', `${target.id} in ${target.home}`)
  }

  const logs = []
  const paths = await store.paths(target, { onLog: (l) => logs.push(l) })
  if (paths.os && paths.store_folder) ok('paths', `${paths.os} → ${paths.store_folder}`)
  else bad('paths', JSON.stringify(paths))

  const listing = await store.list(target, { onLog: (l) => logs.push(l) })
  const games = listing.games || []
  if (!games.length) return bad('list', 'no games came back')

  const modes = games.reduce((acc, g) => {
    acc[g.mode] = (acc[g.mode] || 0) + 1
    return acc
  }, {})
  ok('list', `${games.length} titles (${Object.entries(modes).map(([m, n]) => `${m}:${n}`).join(', ')})`)

  const required = ['name', 'title', 'platform', 'version', 'mode', 'kind', 'installed', 'update_available']
  const broken = games.filter((g) => required.some((k) => g[k] === undefined))
  if (broken.length) bad('game shape', `${broken.length} entries miss a field`)
  else ok('game shape', required.join(', '))

  const hosted = games.filter((g) => g.mode === 'web')
  if (hosted.length && !hosted.every((g) => /^https?:\/\//.test(g.url || ''))) {
    bad('hosted urls', 'a web title has no usable url')
  } else if (hosted.length) {
    ok('hosted urls', hosted[0].url)
  }

  const installed = games.filter((g) => g.installed)
  ok('installed', `${installed.length} of ${games.length}`)
  if (installed.length) {
    const withTarget = installed.filter((g) => g.menu_entry || g.exe || g.url)
    if (withTarget.length !== installed.length) bad('launch targets', 'an installed title has nothing to launch')
    else ok('launch targets', 'every installed title has one')
  }

  if (logs.length) ok('stderr log', `${logs.length} lines (kept off stdout)`)
}

main().catch((err) => {
  console.log(`  FAIL  ${err && err.code ? err.code : 'error'}: ${err && err.message ? err.message : err}`)
  process.exitCode = 1
})
