import fs from 'node:fs'
import path from 'node:path'
import { safeStorage } from 'electron'
import type { CredentialRepository } from '../../domain/ports/CredentialRepository'
import type { ApplicationEnvironment } from '../../domain/ports/ApplicationEnvironment'

const FILE_NAME = 'credentials.json'

/**
 * Tokens in the OS keychain's own encryption, in the application's data directory.
 *
 * Not in the store home next to `config.json` and `state.json`: those two are the
 * store's public description of itself and its record of what it installed, both
 * meant to be read and both copied around when somebody moves a library. A password
 * does not belong in either.
 *
 * `safeStorage` is Electron's wrapper over the platform keychain (Keychain on macOS,
 * libsecret on Linux, DPAPI on Windows). Where it is unavailable — a Linux box with no
 * secret service — this stores nothing at all rather than falling back to plain text.
 * The cost is signing in again next run; the alternative is a readable token on disk
 * for somebody who thought it was encrypted.
 */
export class SafeStorageCredentialRepository implements CredentialRepository {
  public constructor (private readonly environment: ApplicationEnvironment) {}

  public readToken (storeId: string): string | null {
    if (!this.available()) return null
    const encoded = this.readAll()[storeId]
    if (typeof encoded !== 'string') return null

    try {
      return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
    } catch {
      // A token encrypted under a keychain this machine no longer has. Signing in
      // again is the only way through, and an unreadable entry is not worth an error.
      return null
    }
  }

  public writeToken (storeId: string, token: string): void {
    if (!this.available()) return

    const all = { ...this.readAll() }
    all[storeId] = safeStorage.encryptString(token).toString('base64')
    this.writeAll(all)
  }

  public clearToken (storeId: string): void {
    const all = this.readAll()
    if (!(storeId in all)) return

    // Rebuilt without the key rather than deleted from a copy: the linter forbids a
    // dynamic delete, and this says the same thing without pretending the object was
    // ever mutable.
    const remaining = Object.fromEntries(
      Object.entries(all).filter(([key]: readonly [string, unknown]): boolean => key !== storeId)
    )
    this.writeAll(remaining)
  }

  public available (): boolean {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  private readAll (): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.filePath(), 'utf8'))
      return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }

  private writeAll (all: Record<string, unknown>): void {
    try {
      const target = this.filePath()
      fs.mkdirSync(path.dirname(target), { recursive: true })
      // 0600 as well as the encryption: defence in depth costs one argument here, and
      // the file is only ever read by this application.
      fs.writeFileSync(target, `${JSON.stringify(all, null, 2)}\n`, { mode: 0o600 })
    } catch {
      // A token that could not be saved means signing in again next run, which is not
      // worth stopping the application for.
    }
  }

  private filePath (): string {
    return this.environment.resolveUserDataPath(FILE_NAME)
  }
}
