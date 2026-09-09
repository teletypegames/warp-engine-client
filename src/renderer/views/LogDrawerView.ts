import { createElement, requireElement, setHidden, setText } from '../dom/Dom'
import type { AppState } from '../state/AppStore'

export interface LogDrawerViewCallbacks {
  readonly onOpenFolder: (directory: string) => void
  readonly onToggle: () => void
}

/**
 * The store's own output, verbatim, and the folders everything lands in.
 *
 * Off screen until asked for. The window used to carry a footer with a toggle and a
 * line of absolute paths at all times; both were clutter next to the one thing the
 * window is for, which is the titles. The switch lives in the side menu with the rest
 * of what is not a title, and the panel appears above the grid only while it is on.
 *
 * The lines and the open flag are state, not something this view keeps: it draws what
 * the store holds, so the log survives a rebuild of the view like everything else does.
 */
export class LogDrawerView {
  private readonly toggle = requireElement('log-toggle', HTMLButtonElement)
  private readonly panel = requireElement('log-panel', HTMLElement)
  private readonly lines = requireElement('log-lines', HTMLElement)
  private readonly pathsBox = requireElement('log-paths', HTMLElement)

  public constructor (private readonly callbacks: LogDrawerViewCallbacks) {
    this.toggle.addEventListener('click', callbacks.onToggle)
  }

  public render (state: AppState): void {
    setText(this.toggle, state.messages.log)
    setHidden(this.panel, !state.logOpen)
    this.toggle.setAttribute('aria-expanded', String(state.logOpen))
    this.toggle.classList.toggle('is-active', state.logOpen)

    this.renderLines(state)
    this.renderPaths(state)
  }

  /**
   * Rebuilt only when the lines changed: the store re-renders on every progress event,
   * and four hundred nodes replaced for a counter tick would make the drawer the most
   * expensive thing in the window. The last line is the tell — a new line changes it,
   * and so does the cap pushing the oldest one out.
   */
  private renderLines (state: AppState): void {
    const last = this.lines.lastElementChild
    const unchanged = this.lines.childElementCount === state.logLines.length &&
      (last === null || last.textContent === state.logLines[state.logLines.length - 1])
    if (!unchanged) {
      this.lines.replaceChildren(...state.logLines.map((line: string): HTMLElement =>
        createElement('div', 'log-line', line)))
    }
    if (state.logOpen) this.lines.scrollTop = this.lines.scrollHeight
  }

  private renderPaths (state: AppState): void {
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
}
