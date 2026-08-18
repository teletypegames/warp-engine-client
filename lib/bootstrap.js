'use strict'
// Setting up the store when there is none yet.
//
// This is the reason the client exists on Windows at all: the shell installer is
// `curl … | sh`, which Windows does not have. The three files it would place are
// downloaded here instead, into the very same store home — so the CLI and the
// client stay one installation, and running install.sh afterwards only adds the
// launcher script.

const fs = require('node:fs')
const https = require('node:https')
const path = require('node:path')

const FORGE = 'https://git.teletypegames.org'
const SOURCES = {
  engine: `${FORGE}/stores/warp-engine-desktop-store/raw/branch/master/desktop_store.py`,
  core: `${FORGE}/engines/warpstore/raw/branch/master/warpstore.py`,
  config: `${FORGE}/stores/ttg-desktop-store/raw/branch/master/config.json`
}

/** GET a URL as a string, following redirects — a moved repo answers 301. */
function fetchText (url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'warp-engine-desktop-gui' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        if (redirects <= 0) return reject(new Error(`too many redirects for ${url}`))
        const next = new URL(res.headers.location, url).toString()
        return fetchText(next, redirects - 1).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`${url} answered ${res.statusCode}`))
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
 * Download the engine, the shared core and the store's config into `home`.
 *
 * `onLog` reports each step, because on a slow line this takes a few seconds and
 * silence looks like a hang. An existing config is left alone: a store that is
 * already set up keeps its settings.
 */
async function install (home, { onLog = () => {} } = {}) {
  fs.mkdirSync(home, { recursive: true })
  const wrote = []

  for (const [name, file] of [['engine', 'desktop_store.py'], ['core', 'warpstore.py']]) {
    onLog(`downloading ${file}`)
    const body = await fetchText(SOURCES[name])
    if (!body.startsWith('#!/usr/bin/env python3')) {
      throw new Error(`${file} does not look like the store engine — refusing to install it`)
    }
    const dest = path.join(home, file)
    fs.writeFileSync(dest, body, { mode: 0o755 })
    wrote.push(dest)
  }

  const config = path.join(home, 'config.json')
  if (fs.existsSync(config)) {
    onLog('keeping the config already in place')
  } else {
    onLog('downloading config.json')
    const body = await fetchText(SOURCES.config)
    JSON.parse(body) // a broken config would fail later and less clearly
    fs.writeFileSync(config, body)
    wrote.push(config)
  }

  onLog(`the store is set up in ${home}`)
  return { home, config, script: path.join(home, 'desktop_store.py'), wrote }
}

module.exports = { FORGE, SOURCES, fetchText, install }
