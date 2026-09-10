import path from 'node:path'
import {
  app, BrowserWindow, shell, type BrowserWindowConstructorOptions, type Event,
  type RenderProcessGoneDetails, type WebContentsConsoleMessageEventParams
} from 'electron'

const WINDOW_OPTIONS: BrowserWindowConstructorOptions = {
  width: 1040,
  height: 720,
  minWidth: 760,
  minHeight: 520,
  backgroundColor: '#11151c'
}

/**
 * The window icon, in development only.
 *
 * A packaged app carries its icon in the bundle, the .exe and the .desktop entry, and
 * `resources/` is not inside the package at all — pointing at it there would be a path
 * that does not exist. Run from source there is nothing to carry the icon, so the
 * window and the taskbar show Electron's own, which makes a dev run look like a
 * different application from the one being built. macOS ignores this either way: the
 * Dock icon comes from the bundle.
 */
function developmentIcon (): Pick<BrowserWindowConstructorOptions, 'icon'> {
  if (app.isPackaged) return {}

  return { icon: path.join(__dirname, '..', '..', 'resources', 'icons', '512x512.png') }
}

/**
 * The one window.
 *
 * Locked down deliberately: context isolation on, node integration off, sandbox on,
 * and the page carries a CSP of its own. Nothing here should ever navigate away or
 * open a second window — a link the user clicks goes to their browser instead.
 */
export class MainWindowFactory {
  public constructor (
    private readonly onRendererMessage: (message: string, level: number) => void,
    private readonly title: string
  ) {}

  public createWindow (): BrowserWindow {
    const window = new BrowserWindow({
      ...WINDOW_OPTIONS,
      title: this.title,
      ...developmentIcon(),
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
    window.webContents.on('console-message', (details: Event<WebContentsConsoleMessageEventParams>): void => {
      const level = details.level === 'error' ? 3 : details.level === 'warning' ? 2 : 1
      this.onRendererMessage(details.message, level)
    })
    window.webContents.on('render-process-gone', (_event: Event, details: RenderProcessGoneDetails): void => {
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
