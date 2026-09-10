import { createElement, describeControl, requireElement, setHidden, setText } from '../dom/Dom'
import type { InstalledStoreDto } from '../../shared/contracts/dto/InstalledStoreDto'
import {
  buildFilterSections, isEverything, type FilterAxis, type FilterSection
} from '../state/CatalogFilter'
import type { AppState } from '../state/AppStore'

export interface SideMenuViewCallbacks {
  readonly onSelectStore: (home: string) => void
  readonly onRefresh: () => void
  readonly onToggleFilter: (axis: FilterAxis, value: string) => void
  readonly onClearFilters: () => void
  /** Sign in when signed out, sign out when signed in: the store knows which. */
  readonly onToggleSignedIn: () => void
  readonly onOpenSettings: () => void
}

/**
 * The side menu: which store, what to look at, and the way into the settings.
 *
 * Everything that is not a title lives here or behind the gear, and the bar's button
 * folds it away.
 */
export class SideMenuView {
  private readonly storesHead = requireElement('head-stores', HTMLElement)
  private readonly categoriesHead = requireElement('head-cats', HTMLElement)
  private readonly storeList = requireElement('store-list', HTMLElement)
  private readonly refresh = requireElement('refresh', HTMLButtonElement)
  private readonly filters = requireElement('cats', HTMLElement)
  private readonly clearFilters = requireElement('filters-clear', HTMLButtonElement)
  private readonly accountBlock = requireElement('account-block', HTMLElement)
  private readonly accountHead = requireElement('head-account', HTMLElement)
  private readonly accountState = requireElement('account-state', HTMLElement)
  private readonly accountAction = requireElement('account-action', HTMLButtonElement)
  private readonly appVersion = requireElement('app-version', HTMLElement)
  private readonly settings = requireElement('settings-open', HTMLButtonElement)

  public constructor (private readonly callbacks: SideMenuViewCallbacks) {
    this.refresh.addEventListener('click', callbacks.onRefresh)
    this.clearFilters.addEventListener('click', callbacks.onClearFilters)
    this.accountAction.addEventListener('click', callbacks.onToggleSignedIn)
    this.settings.addEventListener('click', callbacks.onOpenSettings)
  }

  public render (state: AppState): void {
    setText(this.storesHead, state.messages.stores)
    setText(this.categoriesHead, state.messages.categories)
    // Refresh and the gear are icons: naming them is all the view does, and writing
    // text into them would replace the glyph.
    describeControl(this.refresh, state.messages.refresh)
    describeControl(this.settings, state.messages.settings)
    setText(this.appVersion, state.appVersion)

    this.renderStores(state)
    this.renderAccount(state)
    this.renderFilters(state)
    this.renderEnabled(state)
  }

  private renderStores (state: AppState): void {
    const activeHome = state.currentStore === null ? null : state.currentStore.home
    // Two stores can carry the same id in different roots — the same catalog
    // installed twice. Then the id says nothing and the folder is what tells them
    // apart, so that is what the row shows.
    const ambiguousIds = new Set(state.stores
      .filter((store: InstalledStoreDto, index: number): boolean =>
        state.stores.findIndex((other: InstalledStoreDto): boolean => other.id === store.id) !== index)
      .map((store: InstalledStoreDto): string => store.id))

    this.storeList.replaceChildren(...state.stores.map((store: InstalledStoreDto): HTMLElement => {
      // A wrapper with the button inside it, so the framing and the click target are
      // the same size; the row only switches — the rest happens in the settings.
      const row = createElement('div', 'store-row')
      if (store.home === activeHome) row.classList.add('is-active')

      const open = createElement('button', 'store-row-open')
      open.appendChild(createElement('span', 'store-row-name', store.name))
      open.appendChild(createElement('span', 'store-row-id',
        ambiguousIds.has(store.id) ? store.home : store.id))
      open.title = store.home
      open.addEventListener('click', (): void => {
        if (store.home !== activeHome) this.callbacks.onSelectStore(store.home)
      })
      row.appendChild(open)
      return row
    }))
  }

  /**
   * The account block, or nothing at all.
   *
   * Hidden outright where the catalog offers no sign-in — which is most of them. A
   * disabled "Sign in" would be telling somebody about a door that is not there.
   */
  private renderAccount (state: AppState): void {
    setHidden(this.accountBlock, !state.account.signInAvailable)
    if (!state.account.signInAvailable) return

    setText(this.accountHead, state.messages.account)
    setText(this.accountState, state.account.signedIn ? state.messages.signedIn : '')
    setText(this.accountAction, state.account.signedIn
      ? state.messages.signOut
      : state.messages.signIn)
    // A sign-in already under way has its own panel with a cancel on it; a second
    // "Sign in" here would start a second flow behind the first one's code.
    this.accountAction.disabled = state.busy || state.signIn !== null
  }

  /**
   * The filter, one block per axis.
   *
   * The status axis is a list, because exactly one of its entries is on and a list
   * reads as a choice; the others are chips, because any of them can be on or off and a
   * chip reads as a switch. Both carry the faceted count, so a person sees what a click
   * would do before doing it. "Clear" only exists while there is something to clear.
   */
  private renderFilters (state: AppState): void {
    const sections = buildFilterSections(state.games, state.filter, state.messages)
    const nodes: HTMLElement[] = []
    for (const section of sections) {
      const block = createElement('div', 'filter-axis')
      block.appendChild(createElement('div', 'filter-axis-title', section.title))
      block.appendChild(section.exclusive ? this.createList(section) : this.createChips(section))
      nodes.push(block)
    }
    this.filters.replaceChildren(...nodes)

    setText(this.clearFilters, state.messages.clearFilters)
    setHidden(this.clearFilters, isEverything(state.filter))
  }

  private createList (section: FilterSection): HTMLElement {
    const list = createElement('div', 'filter-list')
    list.setAttribute('role', 'radiogroup')
    for (const option of section.options) {
      const row = createElement('button', 'cat')
      row.setAttribute('role', 'radio')
      row.setAttribute('aria-checked', String(option.active))
      if (option.active) row.classList.add('is-active')
      row.appendChild(createElement('span', 'cat-label', option.label))
      row.appendChild(createElement('span', 'cat-count', String(option.count)))
      row.addEventListener('click', (): void => { this.callbacks.onToggleFilter(option.axis, option.value) })
      list.appendChild(row)
    }
    return list
  }

  private createChips (section: FilterSection): HTMLElement {
    const chips = createElement('div', 'filter-chips')
    for (const option of section.options) {
      const chip = createElement('button', 'chip')
      chip.setAttribute('aria-pressed', String(option.active))
      if (option.active) chip.classList.add('is-active')
      // A chip that would show nothing stays, dimmed: it says the value exists in the
      // catalog and the other axes are what is hiding it.
      if (option.count === 0 && !option.active) chip.classList.add('is-empty')
      chip.appendChild(createElement('span', 'chip-label', option.label))
      chip.appendChild(createElement('span', 'chip-count', String(option.count)))
      chip.addEventListener('click', (): void => { this.callbacks.onToggleFilter(option.axis, option.value) })
      chips.appendChild(chip)
    }
    return chips
  }

  /**
   * While the store is working only what would start a second call is disabled; the
   * filters stay live because they change what is on screen and nothing on disk. The
   * gear stays live too: the dialog disables its own writes.
   */
  private renderEnabled (state: AppState): void {
    const hasStore = state.currentStore !== null
    this.refresh.disabled = state.busy || !hasStore
    for (const row of this.storeList.querySelectorAll('button')) row.disabled = state.busy
  }
}
