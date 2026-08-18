import { createElement, requireElement, setText } from '../dom/Dom'
import type { AppState } from '../state/AppStore'

const MAX_LOG_LINES = 400

export interface LogDrawerViewCallbacks {
  readonly onOpenFolder: (directory: string) => void
}

/** The store's own output, verbatim, and the folders everything lands in. */
export class LogDrawerView {
  private readonly toggle = requireElement('log-toggle', HTMLButtonElement)
  private readonly lines = requireElement('log-lines', HTMLElement)
  private readonly pathsBox = requireElement('log-paths', HTMLElement)

  public constructor (private readonly callbacks: LogDrawerViewCallbacks) {
    this.toggle.addEventListener('click', (): void => {
      this.lines.hidden = !this.lines.hidden
      this.toggle.setAttribute('aria-expanded', String(!this.lines.hidden))
    })
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
