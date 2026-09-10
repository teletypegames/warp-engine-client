import { describeError } from '../../domain/errors/DescribeError'
import type { BridgeApi } from '../../shared/contracts/BridgeApi'
import type { AppStore } from '../state/AppStore'

/**
 * The client's own update check, as the window performs it.
 *
 * Nothing is installed from here: the check answers with a version and a page, the
 * page is opened in the browser, and the person picks the package for their machine.
 */
export class ClientUpdateController {
  public constructor (
    private readonly bridge: BridgeApi,
    private readonly store: AppStore
  ) {}

  public async checkForUpdates (): Promise<void> {
    this.store.applyClientUpdate({ phase: 'checking' })
    try {
      const result = await this.bridge.checkForUpdates()
      this.store.applyClientUpdate({ phase: 'checked', result })
      this.store.applyLogLine(result.updateAvailable
        ? `client ${result.currentVersion}: ${result.latestVersion} is published at ${result.releaseUrl}`
        : `client ${result.currentVersion}: the latest release`)
    } catch (error: unknown) {
      this.store.applyClientUpdate({ phase: 'failed' })
      this.store.applyLogLine(`update check: ${describeError(error)}`)
    }
  }

  public async openRelease (): Promise<void> {
    const update = this.store.readState().clientUpdate
    if (update?.phase !== 'checked') return
    await this.bridge.openUrl(update.result.releaseUrl)
  }
}
