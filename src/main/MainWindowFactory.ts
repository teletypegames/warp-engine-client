import path from 'node:path'
import { BrowserWindow, shell, type BrowserWindowConstructorOptions } from 'electron'

const WINDOW_OPTIONS: BrowserWindowConstructorOptions = {
  width: 1040,
  height: 720,
  minWidth: 760,
  minHeight: 520,
  backgroundColor: '#11151c',
  title: 'WarpEngine Client'
}

/**
 * The one window.
 *
 * Locked down deliberately: context isolation on, node integration off, sandbox on,
 * and the page carries a CSP of its own. Nothing here should ever navigate away or
 * open a second window — a link the user clicks goes to their browser instead.
 */
export class MainWindowFactory {
  public constructor (private readonly onRendererMessage: (message: string, level: number) => void) {}

  public createWindow (): BrowserWindow {
    const window = new BrowserWindow({
      ...WINDOW_OPTIONS,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    })

    void window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
    this.forwardRendererDiagnostics(window)
    this.denyNavigation(window)
    return window
  }

  /** A renderer error is invisible from the main process otherwise. */
  private forwardRendererDiagnostics (window: BrowserWindow): void {
    window.webContents.on('console-message', (details): void => {
      const level = details.level === 'error' ? 3 : details.level === 'warning' ? 2 : 1
      this.onRendererMessage(details.message, level)
    })
    window.webContents.on('render-process-gone', (_event, details): void => {
      this.onRendererMessage(`gone: ${details.reason}`, 3)
    })
  }

  private denyNavigation (window: BrowserWindow): void {
    window.webContents.setWindowOpenHandler(({ url }: { url: string }): { action: 'deny' } => {
      if (url.startsWith('https://')) void shell.openExternal(url)
      return { action: 'deny' }
    })
    window.webContents.on('will-navigate', (event, url: string): void => {
      if (url === window.webContents.getURL()) return
      event.preventDefault()
      if (url.startsWith('https://')) void shell.openExternal(url)
    })
  }
}
