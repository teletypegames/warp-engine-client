import path from 'node:path'
import type { App } from 'electron'
import type { ApplicationEnvironment } from '../../domain/ports/ApplicationEnvironment'

/** The host application, as the services see it. Keeps `electron` out of them. */
export class ElectronApplicationEnvironment implements ApplicationEnvironment {
  public constructor (private readonly app: App) {}

  public readVersion (): string {
    return this.app.getVersion()
  }

  public readSystemLocale (): string {
    return this.app.getLocale()
  }

  public resolveUserDataPath (fileName: string): string {
    return path.join(this.app.getPath('userData'), fileName)
  }
}
