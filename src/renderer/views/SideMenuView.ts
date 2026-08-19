import { createElement, requireElement, setText } from '../dom/Dom'
import type { InstalledStoreDto } from '../../shared/contracts/dto/InstalledStoreDto'
import type { Locale } from '../../shared/i18n/MessageBundle'
import {
  buildCategorySections, isSameFilter, type CategoryFilter, type CategoryItem
} from '../state/CategoryFilter'
import type { AppState } from '../state/AppStore'

export interface SideMenuViewCallbacks {
  readonly onSelectStore: (home: string) => void
  readonly onRemoveStore: (home: string, name: string) => void
  readonly onAddStore: () => void
  readonly onRefresh: () => void
  readonly onSelectCategory: (filter: CategoryFilter) => void
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
  private readonly categories = requireElement('cats', HTMLElement)
  private readonly accountBlock = requireElement('account-block', HTMLElement)
  private readonly accountHead = requireElement('head-account', HTMLElement)
  private readonly accountState = requireElement('account-state', HTMLElement)
  private readonly accountAction = requireElement('account-action', HTMLButtonElement)
  private readonly locale = requireElement('locale', HTMLSelectElement)
  /** The square around the select: it is what a pointer hovers, so the tooltip is its. */
  private readonly localeControl = requireElement('locale-control', HTMLElement)

  public constructor (private readonly callbacks: SideMenuViewCallbacks) {
    this.addStore.addEventListener('click', callbacks.onAddStore)
    this.refresh.addEventListener('click', callbacks.onRefresh)
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

    this.renderStores(state)
    this.renderAccount(state)
    this.renderCategories(state)
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
    this.accountBlock.hidden = !state.account.signInAvailable
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

  private renderCategories (state: AppState): void {
    const sections = buildCategorySections(state.games, state.messages)
    const nodes: HTMLElement[] = []
    for (const section of sections) {
      if (section.title !== null) nodes.push(createElement('div', 'cat-group', section.title))
      for (const item of section.items) nodes.push(this.createCategoryRow(item, state.filter))
    }
    this.categories.replaceChildren(...nodes)
  }

  private createCategoryRow (item: CategoryItem, active: CategoryFilter): HTMLElement {
    const row = createElement('button', 'cat')
    if (isSameFilter(item, active)) row.classList.add('is-active')
    row.appendChild(createElement('span', 'cat-label', item.label))
    row.appendChild(createElement('span', 'cat-count', String(item.count)))
    row.addEventListener('click', (): void => {
      this.callbacks.onSelectCategory({ kind: item.kind, value: item.value })
    })
    return row
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
 * Name an icon-only control.
 *
 * `title` is the tooltip a mouse finds and `aria-label` is what a screen reader reads;
 * an icon button needs both, and they are the same sentence.
 */
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

function describeControl (element: HTMLElement, name: string): void {
  element.title = name
  element.setAttribute('aria-label', name)
}
