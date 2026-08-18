import path from 'node:path'
import { BrowserWindow, dialog, type App, type IpcMain, type Shell } from 'electron'
import { ServiceContainer } from './composition/ServiceContainer'
import { MainWindowFactory } from './MainWindowFactory'
import { SelfTestRunner } from './diagnostics/SelfTestRunner'

const SELFTEST_FLAG = '--selftest'
const SELFTEST_USER_DATA_DIRECTORY = 'warpstore-gui-selftest'
const PRODUCT_NAME = 'WarpEngine Client'

/**
 * The application's lifecycle.
 *
 * Thin on purpose: it owns the window and the process events, and hands everything
 * else to the container. The self-test mode is part of the lifecycle because it has
 * to bypass two of its rules — see below.
 */
export class ElectronApplication {
  private readonly selfTest: boolean
  private readonly container: ServiceContainer
  private readonly windowFactory: MainWindowFactory
  private window: BrowserWindow | null = null

  public constructor (
    private readonly app: App,
    private readonly ipc: IpcMain,
    shell: Shell,
    argv: readonly string[] = process.argv
  ) {
    this.selfTest = argv.includes(SELFTEST_FLAG)
    this.container = new ServiceContainer(app, shell)
    this.windowFactory = new MainWindowFactory((message: string, level: number): void => {
      if (level >= 2 || this.selfTest) console.log(`[renderer] ${message}`)
    })
  }

  public start (): void {
    // A test run must never be swallowed by a copy the user already has open: it
    // gets its own user-data directory and skips the single-instance lock. Without
    // this the second process exits silently with status 0, which reads as a pass.
    if (this.selfTest) {
      this.app.setPath('userData', path.join(this.app.getPath('temp'), SELFTEST_USER_DATA_DIRECTORY))
    } else if (!this.app.requestSingleInstanceLock()) {
      this.app.quit()
      return
    }

    this.container.registerIpc(this.ipc)
    this.app.on('second-instance', (): void => { this.focusWindow() })
    this.app.on('activate', (): void => {
      if (BrowserWindow.getAllWindows().length === 0) this.openWindow()
    })
    this.app.on('window-all-closed', (): void => {
      if (process.platform !== 'darwin') this.app.quit()
    })
    process.on('unhandledRejection', (reason: unknown): void => {
      dialog.showErrorBox(PRODUCT_NAME, reason instanceof Error ? reason.message : String(reason))
    })

    void this.app.whenReady().then((): void => { this.openWindow() })
  }

  private openWindow (): void {
    const window = this.windowFactory.createWindow()
    this.window = window
    this.container.streams.attachWindow(window)
    window.on('closed', (): void => {
      this.container.streams.detachWindow()
      this.window = null
    })
    if (this.selfTest) this.scheduleSelfTest(window)
  }

  private scheduleSelfTest (window: BrowserWindow): void {
    const runner = new SelfTestRunner(window)
    window.webContents.once('did-finish-load', (): void => {
      // The first listing has to finish before there is anything to look at.
      setTimeout((): void => {
        runner.run().then(
          (passed: boolean): void => { this.app.exit(passed ? 0 : 1) },
          (error: unknown): void => {
            console.log(`SELFTEST ERROR ${error instanceof Error ? error.message : String(error)}`)
            this.app.exit(1)
          }
        )
      }, runner.settleDelayMs)
    })
  }

  private focusWindow (): void {
    const window = this.window
    if (window === null) return
    if (window.isMinimized()) window.restore()
    window.focus()
  }
}
