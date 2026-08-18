import { requireElement, setHidden, setText } from '../dom/Dom'
import type { AppState } from '../state/AppStore'

export interface TopBarViewCallbacks {
  readonly onToggleNavigation: () => void
}

/** The bar: what this is, which store is open, and how far a sync has got. */
export class TopBarView {
  private readonly appName = requireElement('app-name', HTMLElement)
  private readonly storeId = requireElement('store-id', HTMLElement)
  private readonly progress = requireElement('progress', HTMLElement)
  private readonly navToggle = requireElement('nav-toggle', HTMLButtonElement)

  public constructor (callbacks: TopBarViewCallbacks) {
    this.navToggle.addEventListener('click', callbacks.onToggleNavigation)
  }

  public render (state: AppState): void {
    setText(this.appName, state.messages.appName)
    // The bar names the app, not the store: which store is open is what the switcher in
    // the side menu says, and saying it twice made the title read like a breadcrumb. The
    // element stays in the page, hidden, because the window check reads it.
    setText(this.storeId, state.currentStore === null ? '' : state.currentStore.id)
    this.navToggle.title = state.messages.menu
    this.navToggle.setAttribute('aria-label', state.messages.menu)
    this.navToggle.setAttribute('aria-expanded', String(state.navigationOpen))

    const progress = state.progress
    setHidden(this.progress, progress === null)
    setText(this.progress, progress === null ? '' : progress.label)
  }
}
