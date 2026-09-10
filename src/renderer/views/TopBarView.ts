import { describeControl, requireElement, setHidden, setText } from '../dom/Dom'
import type { AppState } from '../state/AppStore'

export interface TopBarViewCallbacks {
  readonly onToggleNavigation: () => void
  readonly onToggleViewMode: () => void
  readonly onSearch: (query: string) => void
}

/** The bar: what this is, which store is open, the search box, and how far a sync has got. */
export class TopBarView {
  private readonly appName = requireElement('app-name', HTMLElement)
  private readonly storeId = requireElement('store-id', HTMLElement)
  private readonly progress = requireElement('progress', HTMLElement)
  private readonly navToggle = requireElement('nav-toggle', HTMLButtonElement)
  private readonly viewToggle = requireElement('view-toggle', HTMLButtonElement)
  private readonly search = requireElement('search', HTMLInputElement)
  // Inline <svg> elements are SVGSVGElement, not HTMLElement; asking for the wrong
  // type here threw in the constructor and left the whole window blank.
  private readonly viewIconGrid = requireElement('view-icon-grid', SVGSVGElement)
  private readonly viewIconList = requireElement('view-icon-list', SVGSVGElement)

  public constructor (callbacks: TopBarViewCallbacks) {
    this.navToggle.addEventListener('click', callbacks.onToggleNavigation)
    this.viewToggle.addEventListener('click', callbacks.onToggleViewMode)
    this.search.addEventListener('input', (): void => { callbacks.onSearch(this.search.value) })
    this.search.addEventListener('keydown', (event: KeyboardEvent): void => {
      if (event.key === 'Escape') callbacks.onSearch('')
    })
  }

  public render (state: AppState): void {
    // A branded build is called what the brand says, in the bar and on the window;
    // the generic client keeps its own name.
    const appName = state.brand?.name ?? state.messages.appName
    setText(this.appName, appName)
    if (document.title !== appName) document.title = appName
    setText(this.storeId, state.currentStore === null ? '' : state.currentStore.id)
    describeControl(this.navToggle, state.messages.menu)
    this.navToggle.setAttribute('aria-expanded', String(state.navigationOpen))

    const isGrid = state.viewMode === 'grid'
    setHidden(this.viewIconGrid, !isGrid)
    setHidden(this.viewIconList, isGrid)
    describeControl(this.viewToggle, isGrid ? state.messages.listView : state.messages.gridView)

    describeControl(this.search, state.messages.search)
    this.search.placeholder = state.messages.search
    setHidden(this.search, state.gate !== null || state.currentStore === null)
    // The state is the authority over the box, but a field rewritten under somebody's
    // fingers loses the caret; so it is written back only when it disagrees and nobody
    // is typing in it — which is what Clear in the side menu needs.
    if (document.activeElement !== this.search && this.search.value !== state.filter.query) {
      this.search.value = state.filter.query
    }

    const progress = state.progress
    setHidden(this.progress, progress === null)
    setText(this.progress, progress === null ? '' : progress.label)
  }
}
