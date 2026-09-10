import fs from 'node:fs'
import path from 'node:path'
import { asRecord, readRecord, readString } from '../json/JsonRecord'

/**
 * What was decided when this package was built.
 *
 * The registry address is the one thing about a particular site left in the client, and
 * a build for a different site should not need a different source tree. So it is a field
 * in `package.json`, which `electron-builder` can overwrite at packaging time:
 *
 *   make dist STORES_API=https://staging.example.org/api/stores
 *
 * Read from the package.json that ships inside the app, so a packaged build answers with
 * what it was built with. A runtime `STORES_API` still wins over it — that is for trying
 * something out, this is for shipping it.
 */
export class BuildConfiguration {
  private cached: Readonly<Record<string, unknown>> | null = null

  public readRegistryUrl (): string | null {
    const section = readRecord(this.read(), 'warpEngine')
    if (section === null) return null
    const url = readString(section, 'registryUrl').trim()
    return url.length > 0 ? url : null
  }

  /** Where this client's own releases are listed; null means the built-in forge. */
  public readReleasesApiUrl (): string | null {
    const section = readRecord(this.read(), 'warpEngine')
    if (section === null) return null
    const url = readString(section, 'releasesUrl').trim()
    return url.length > 0 ? url : null
  }

  private read (): Readonly<Record<string, unknown>> {
    if (this.cached !== null) return this.cached
    // build/infrastructure/config → the package root, packaged or not.
    const candidates = [
      path.join(__dirname, '..', '..', '..', 'package.json'),
      path.join(__dirname, '..', '..', 'package.json')
    ]
    for (const candidate of candidates) {
      try {
        const parsed = asRecord(JSON.parse(fs.readFileSync(candidate, 'utf8')))
        if (parsed !== null) {
          this.cached = parsed
          return parsed
        }
      } catch {
        // Try the next one; a missing package.json is only fatal if none is found.
      }
    }
    this.cached = {}
    return this.cached
  }
}
