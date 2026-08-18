import { createElement, requireElement, setText } from '../dom/Dom'
import type { InstalledStoreDto } from '../../shared/contracts/dto/InstalledStoreDto'
import type { Locale } from '../../shared/i18n/MessageBundle'
import {
  buildCategorySections, isSameFilter, type CategoryFilter, type CategoryItem
} from '../state/CategoryFilter'
import type { AppState } from '../state/AppStore'

export interface SideMenuViewCallbacks {
  readonly onSelectStore: (home: string) => void
  readonly onAddStore: () => void
  readonly onSyncAll: () => void
  readonly onRefresh: () => void
  readonly onSelectCategory: (filter: CategoryFilter) => void
  readonly onSelectLocale: (locale: string) => void
}

/**
 * The side menu: which store, what to do with it, and what to look at.
 *
 * Everything that is not a title lives here, and the bar's button folds it away.
 */
export class SideMenuView {
  private readonly storesHead = requireElement('head-stores', HTMLElement)
  private readonly actionsHead = requireElement('head-actions', HTMLElement)
  private readonly categoriesHead = requireElement('head-cats', HTMLElement)
  private readonly languageHead = requireElement('head-lang', HTMLElement)
  private readonly storeList = requireElement('store-list', HTMLElement)
  private readonly addStore = requireElement('add-store', HTMLButtonElement)
  private readonly syncAll = requireElement('sync-all', HTMLButtonElement)
  private readonly refresh = requireElement('refresh', HTMLButtonElement)
  private readonly categories = requireElement('cats', HTMLElement)
  private readonly locale = requireElement('locale', HTMLSelectElement)

  public constructor (private readonly callbacks: SideMenuViewCallbacks) {
    this.addStore.addEventListener('click', callbacks.onAddStore)
    this.syncAll.addEventListener('click', callbacks.onSyncAll)
    this.refresh.addEventListener('click', callbacks.onRefresh)
    this.locale.addEventListener('change', (): void => { callbacks.onSelectLocale(this.locale.value) })
  }

  public render (state: AppState): void {
    setText(this.storesHead, state.messages.stores)
    setText(this.actionsHead, state.messages.actions)
    setText(this.categoriesHead, state.messages.categories)
    setText(this.languageHead, state.messages.language)
    setText(this.addStore, state.messages.addStore)
    setText(this.syncAll, state.messages.syncAll)
    setText(this.refresh, state.messages.refresh)

    this.renderStores(state)
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
      const row = createElement('button', 'store-row')
      if (store.home === activeHome) row.classList.add('is-active')
      row.appendChild(createElement('span', 'store-row-name', store.name))
      row.appendChild(createElement('span', 'store-row-id',
        ambiguousIds.has(store.id) ? store.home : store.id))
      row.title = store.home
      row.addEventListener('click', (): void => {
        if (store.home !== activeHome) this.callbacks.onSelectStore(store.home)
      })
      return row
    }))
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
    this.syncAll.disabled = state.busy || !hasStore
    this.refresh.disabled = state.busy || !hasStore
    this.addStore.disabled = state.busy
    for (const row of this.storeList.querySelectorAll('button')) row.disabled = state.busy
  }
}
