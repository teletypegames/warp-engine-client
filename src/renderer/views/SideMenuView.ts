import { createElement, describeControl, requireElement, setHidden, setText } from '../dom/Dom'
import type { InstalledStoreDto } from '../../shared/contracts/dto/InstalledStoreDto'
import type { Locale } from '../../shared/i18n/MessageBundle'
import {
  buildFilterSections, isEverything, type FilterAxis, type FilterSection
} from '../state/CatalogFilter'
import type { AppState } from '../state/AppStore'

export interface SideMenuViewCallbacks {
  readonly onSelectStore: (home: string) => void
  readonly onRemoveStore: (home: string, name: string) => void
  readonly onAddStore: () => void
  readonly onRefresh: () => void
  readonly onToggleFilter: (axis: FilterAxis, value: string) => void
  readonly onClearFilters: () => void
  readonly onSelectLocale: (locale: string) => void
  readonly onSignIn: () => void
  readonly onSignOut: () => void
}

/**
 * The side menu: which store, what to do with it, and what to look at.
 *
 * Everything that is not a title lives here, and the bar's button folds it away.
 */
export class SideMenuView {
  private readonly storesHead = requireElement('head-stores', HTMLElement)
  private readonly categoriesHead = requireElement('head-cats', HTMLElement)
  private readonly storeList = requireElement('store-list', HTMLElement)
  private readonly addStore = requireElement('add-store', HTMLButtonElement)
  private readonly refresh = requireElement('refresh', HTMLButtonElement)
  private readonly filters = requireElement('cats', HTMLElement)
  private readonly clearFilters = requireElement('filters-clear', HTMLButtonElement)
  private readonly accountBlock = requireElement('account-block', HTMLElement)
  private readonly accountHead = requireElement('head-account', HTMLElement)
  private readonly accountState = requireElement('account-state', HTMLElement)
  private readonly accountAction = requireElement('account-action', HTMLButtonElement)
  private readonly locale = requireElement('locale', HTMLSelectElement)
  private readonly appVersion = requireElement('app-version', HTMLElement)
  /** The square around the select: it is what a pointer hovers, so the tooltip is its. */
  private readonly localeControl = requireElement('locale-control', HTMLElement)

  public constructor (private readonly callbacks: SideMenuViewCallbacks) {
    this.addStore.addEventListener('click', callbacks.onAddStore)
    this.refresh.addEventListener('click', callbacks.onRefresh)
    this.clearFilters.addEventListener('click', callbacks.onClearFilters)
    this.locale.addEventListener('change', (): void => { callbacks.onSelectLocale(this.locale.value) })
    this.accountAction.addEventListener('click', (): void => {
      if (this.signedIn) this.callbacks.onSignOut()
      else this.callbacks.onSignIn()
    })
  }

  /**
   * Which of the two the one button does.
   *
   * Read at click time rather than rebound on every render: a listener replaced under
   * a pointer that is already down is a click that goes nowhere.
   */
  private signedIn = false

  public render (state: AppState): void {
    setText(this.storesHead, state.messages.stores)
    setText(this.categoriesHead, state.messages.categories)
    // Add is an icon now, beside Refresh: naming it is all the view does, and writing
    // text into it would replace the glyph.
    describeControl(this.addStore, state.messages.addStoreHint)
    // Refresh and the language picker are icons: naming them is all the view does, and
    // writing text into them would replace the glyph.
    describeControl(this.refresh, state.messages.refresh)
    // The picker is two elements: the invisible select takes the focus and the reader's
    // name, the square around it takes the hover and the tooltip.
    describeControl(this.locale, state.messages.language)
    this.localeControl.title = state.messages.language

    setText(this.appVersion, state.appVersion)
    this.renderStores(state)
    this.renderAccount(state)
    this.renderFilters(state)
    this.renderLocales(state)
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
      // A row is a button *and* carries one; nesting them would be invalid markup and
      // the inner click would reach the outer handler anyway. So the row is a wrapper
      // with two buttons in it: switch, and remove.
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

      const remove = createElement('button', 'store-row-remove')
      remove.appendChild(createTrashIcon())
      describeControl(remove, state.messages.removeStore)
      remove.addEventListener('click', (): void => {
        this.callbacks.onRemoveStore(store.home, store.name)
      })
      row.appendChild(remove)

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

    this.signedIn = state.account.signedIn
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

  private renderLocales (state: AppState): void {
    const current = this.locale.value
    if (current === state.locale && this.locale.options.length === state.locales.length) return
    this.locale.replaceChildren(...state.locales.map((locale: Locale): HTMLOptionElement => {
      const option = createElement('option', undefined, locale.toUpperCase())
      option.value = locale
      option.selected = locale === state.locale
      return option
    }))
  }

  /**
   * While the store is working only what would start a second call is disabled; the
   * filters stay live because they change what is on screen and nothing on disk.
   */
  private renderEnabled (state: AppState): void {
    const hasStore = state.currentStore !== null
    this.refresh.disabled = state.busy || !hasStore
    this.addStore.disabled = state.busy
    for (const row of this.storeList.querySelectorAll('button')) row.disabled = state.busy
  }
}

/**
 * The remove glyph: a lid and a bin.
 *
 * Drawn rather than a character, for the same reason the other two icons are — a font
 * that lacks the symbol shows a box, and this button has no text to fall back on.
 */
function createTrashIcon (): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'icon icon-trash')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  for (const d of ['M3 4.5h10', 'M6.5 4.5V3h3v1.5', 'M4.5 4.5 5 13h6l.5-8.5', 'M6.8 7v3.5', 'M9.2 7v3.5']) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', d)
    svg.appendChild(path)
  }
  return svg
}
