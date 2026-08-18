'use strict'
// Setting up a store when there is none yet.
//
// This is the reason the client exists on Windows at all: the shell installer is
// `curl … | sh`, which Windows does not have. The three files it would place are
// downloaded here instead, into the very same store home — so the CLI and the
// client stay one installation, and running install.sh afterwards only adds the
// launcher script.
//
// Which store, though, is not baked in. The client asks a registry — `GET
// /api/stores` on the site — and each record says what the store is called, which
// catalog it serves and where its configuration lives. A different site, or a
// second store on ours, needs no change here. The registry address is the one
// address the client does know, and even that is overridable.

const fs = require('node:fs')
const https = require('node:https')
const http = require('node:http')
const path = require('node:path')

// Where the engine itself comes from. Not part of the registry: this is the
// client's own machinery, the same for every store it can drive.
const FORGE = process.env.FORGE_BASE || 'https://git.teletypegames.org'
const ENGINE_SOURCES = {
  'desktop_store.py': `${FORGE}/stores/warp-engine-desktop-store/raw/branch/master/desktop_store.py`,
  'warpstore.py': `${FORGE}/engines/warpstore/raw/branch/master/warpstore.py`
}

// The registry. One address, and the only thing about a particular site left in
// the client.
const REGISTRY_URL = process.env.STORES_API || 'https://teletypegames.org/api/stores'

/** GET a URL as a string, following redirects — a moved repo answers 301. */
function fetchText (url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('http://') ? http : https
    const request = client.get(url, { headers: { 'User-Agent': 'warp-engine-desktop-gui' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        if (redirects <= 0) return reject(new Error(`too many redirects for ${url}`))
        return fetchText(new URL(res.headers.location, url).toString(), redirects - 1).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        const error = new Error(`${url} answered ${res.statusCode}`)
        error.statusCode = res.statusCode
        return reject(error)
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => resolve(body))
    })
    request.setTimeout(60000, () => request.destroy(new Error(`${url} timed out`)))
    request.on('error', reject)
  })
}

/**
 * The stores this client can install, from the site's registry.
 *
 * Each record carries a name, the catalog it serves and the repository holding
 * its config. Anything without those three is dropped rather than half-used.
 */
async function registry (url = REGISTRY_URL) {
  const body = await fetchText(url)
  const rows = JSON.parse(body)
  if (!Array.isArray(rows)) throw new Error(`${url} did not answer with a list of stores`)
  return rows
    .map((row) => ({
      name: String(row.name || '').trim(),
      catalogUrl: String(row.catalogUrl || row.catalog_url || '').trim(),
      storeRepositoryUrl: String(row.storeRepositoryUrl || row.store_repository_url || '').trim()
    }))
    .filter((row) => row.name && row.catalogUrl && row.storeRepositoryUrl)
}

/** `…/stores/ttg-desktop-store` -> the raw config.json on its default branch. */
function configUrl (repositoryUrl, branch = 'master') {
  return `${repositoryUrl.replace(/\/+$/, '')}/raw/branch/${branch}/config.json`
}

/**
 * A store id from its repository name: `ttg-desktop-store` -> `ttg`.
 *
 * The id names the store home and the folder the games land in, so it has to be
 * short and filesystem-safe. The repository name is the best source we have; the
 * store's own config.json overrides it whenever it exists.
 */
function storeId (store) {
  const last = store.storeRepositoryUrl.replace(/\/+$/, '').split('/').pop() || ''
  const base = last.replace(/-(desktop-)?store$/, '') || store.name
  return base.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'store'
}

/**
 * The store's configuration.
 *
 * Its repository is the authority on how the store behaves — which platforms,
 * which statuses, where things land. A repository without a config.json still
 * works: the engine merges whatever it is given onto its own defaults, so a
 * three-field config is a complete one.
 */
async function storeConfig (store, { onLog = () => {} } = {}) {
  const id = storeId(store)
  let config = null
  try {
    onLog(`reading the store config from ${store.storeRepositoryUrl}`)
    config = JSON.parse(await fetchText(configUrl(store.storeRepositoryUrl)))
  } catch (err) {
    if (err.statusCode !== 404) throw err
    onLog('no config.json in the store repository — using the engine defaults')
    config = { paths: { subfolder: id }, catalog: { statuses: ['released', 'archived', 'demo'] } }
  }
  // The registry is the authority on identity and on which catalog to read, so
  // those two win over whatever the file says.
  config.store = { ...(config.store || {}) }
  config.store.id = config.store.id || id
  config.store.name = store.name
  config.store.base_url = store.catalogUrl
  return config
}

/** Where this store's home goes. */
function homeFor (store, root) {
  return path.join(root, `${storeId(store)}-desktop`)
}

/**
 * Install the engine, the shared core and the store's config into `home`.
 *
 * `onLog` reports each step, because on a slow line this takes a few seconds and
 * silence looks like a hang.
 */
async function install (home, store, { onLog = () => {} } = {}) {
  if (!store) throw new Error('no store was chosen')
  fs.mkdirSync(home, { recursive: true })

  for (const [file, url] of Object.entries(ENGINE_SOURCES)) {
    onLog(`downloading ${file}`)
    const body = await fetchText(url)
    if (!body.startsWith('#!/usr/bin/env python3')) {
      throw new Error(`${file} does not look like the store engine — refusing to install it`)
    }
    fs.writeFileSync(path.join(home, file), body, { mode: 0o755 })
  }

  const configPath = path.join(home, 'config.json')
  const config = await storeConfig(store, { onLog })
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)

  onLog(`${store.name} is set up in ${home}`)
  return { home, config: configPath, script: path.join(home, 'desktop_store.py'), id: config.store.id }
}

module.exports = {
  ENGINE_SOURCES, FORGE, REGISTRY_URL,
  configUrl, fetchText, homeFor, install, registry, storeConfig, storeId
}
