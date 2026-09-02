import { requireElement, setHidden, setText } from '../dom/Dom'
import type { AppState } from '../state/AppStore'

export interface TopBarViewCallbacks {
  readonly onToggleNavigation: () => void
  readonly onToggleViewMode: () => void
}

/** The bar: what this is, which store is open, and how far a sync has got. */
export class TopBarView {
  private readonly appName = requireElement('app-name', HTMLElement)
  private readonly storeId = requireElement('store-id', HTMLElement)
  private readonly progress = requireElement('progress', HTMLElement)
  private readonly navToggle = requireElement('nav-toggle', HTMLButtonElement)
  private readonly viewToggle = requireElement('view-toggle', HTMLButtonElement)
  private readonly viewIconGrid = requireElement('view-icon-grid', HTMLElement)
  private readonly viewIconList = requireElement('view-icon-list', HTMLElement)

  public constructor (callbacks: TopBarViewCallbacks) {
    this.navToggle.addEventListener('click', callbacks.onToggleNavigation)
    this.viewToggle.addEventListener('click', callbacks.onToggleViewMode)
  }

  public render (state: AppState): void {
    setText(this.appName, state.messages.appName)
    setText(this.storeId, state.currentStore === null ? '' : state.currentStore.id)
    this.navToggle.title = state.messages.menu
    this.navToggle.setAttribute('aria-label', state.messages.menu)
    this.navToggle.setAttribute('aria-expanded', String(state.navigationOpen))

    const isGrid = state.viewMode === 'grid'
    setHidden(this.viewIconGrid, !isGrid)
    setHidden(this.viewIconList, isGrid)
    this.viewToggle.title = isGrid ? state.messages.listView : state.messages.gridView
    this.viewToggle.setAttribute('aria-label', isGrid ? state.messages.listView : state.messages.gridView)
    this.viewToggle.classList.toggle('view-toggle-active', true)

    const progress = state.progress
    setHidden(this.progress, progress === null)
    setText(this.progress, progress === null ? '' : progress.label)
  }
}
