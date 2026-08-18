import { createElement, requireElement, setHidden, setText } from '../dom/Dom'
import type { AppState } from '../state/AppStore'

const MAX_LOG_LINES = 400

export interface LogDrawerViewCallbacks {
  readonly onOpenFolder: (directory: string) => void
}

/**
 * The store's own output, verbatim, and the folders everything lands in.
 *
 * Off screen until asked for. The window used to carry a footer with a toggle and a
 * line of absolute paths at all times; both were clutter next to the one thing the
 * window is for, which is the titles. The switch lives in the side menu with the rest
 * of what is not a title, and the panel appears above the grid only while it is on.
 */
export class LogDrawerView {
  private readonly toggle = requireElement('log-toggle', HTMLButtonElement)
  private readonly panel = requireElement('log-panel', HTMLElement)
  private readonly lines = requireElement('log-lines', HTMLElement)
  private readonly pathsBox = requireElement('log-paths', HTMLElement)
  private open = false

  public constructor (private readonly callbacks: LogDrawerViewCallbacks) {
    this.toggle.addEventListener('click', (): void => { this.setOpen(!this.open) })
  }

  public render (state: AppState): void {
    setText(this.toggle, state.messages.log)
    this.pathsBox.replaceChildren()
    const paths = state.paths
    if (paths === null) return

    this.pathsBox.appendChild(createElement('div', 'paths-line',
      `${state.messages.paths}: ${paths.storeFolder} · ${paths.menuGroup}`))

    const folders: readonly (readonly [string, string])[] = [
      [state.messages.openStoreFolder, paths.storeFolder],
      [state.messages.openMenuFolder, paths.menuGroup]
    ]
    for (const [label, directory] of folders) {
      const button = createElement('button', 'btn btn-tiny', label)
      button.addEventListener('click', (): void => { this.callbacks.onOpenFolder(directory) })
      this.pathsBox.appendChild(button)
    }
  }

  private setOpen (open: boolean): void {
    this.open = open
    setHidden(this.panel, !open)
    this.toggle.setAttribute('aria-expanded', String(open))
    this.toggle.classList.toggle('is-active', open)
    if (open) this.lines.scrollTop = this.lines.scrollHeight
  }

  /**
   * A line arriving while the panel is shut does not open it: the store logs on every
   * refresh, and a window that unfolded a panel by itself would be worse than one that
   * kept quiet. The lines are kept, so opening it later shows what happened.
   */
  public appendLine (line: string): void {
    this.lines.appendChild(createElement('div', 'log-line', line))
    while (this.lines.childElementCount > MAX_LOG_LINES) {
      const first = this.lines.firstElementChild
      if (first === null) break
      first.remove()
    }
    this.lines.scrollTop = this.lines.scrollHeight
  }
}
