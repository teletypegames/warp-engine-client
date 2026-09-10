import type { GameDto } from '../../shared/contracts/dto/GameDto'
import type { InstalledStoreDto } from '../../shared/contracts/dto/InstalledStoreDto'
import type { RegistryStoreDto } from '../../shared/contracts/dto/RegistryStoreDto'
import type { ViewMode } from '../../shared/contracts/dto/AppStateDto'
import type { Locale } from '../../shared/i18n/MessageBundle'
import { createElement, describeControl, requireElement, setHidden, setText } from '../dom/Dom'
import { createIcon } from '../dom/Icon'
import type { AppState } from '../state/AppStore'
import { SETTINGS_TABS, type SettingsTab } from '../state/SettingsTab'

export interface SettingsViewCallbacks {
  readonly onClose: () => void
  readonly onSelectTab: (tab: SettingsTab) => void
  readonly onBeginRename: (home: string) => void
  readonly onCancelRename: () => void
  readonly onRename: (home: string, name: string) => void
  readonly onRemoveStore: (home: string, name: string) => void
  /** A store from the registry's list, named by its catalog. */
  readonly onAddStore: (catalogUrl: string) => void
  readonly onAddCatalog: (catalogUrl: string) => void
  readonly onSelectLocale: (locale: string) => void
  readonly onSelectViewMode: (mode: ViewMode) => void
  readonly onCheckForUpdates: () => void
  /** Bring one installed title up to the catalog's version. */
  readonly onUpgrade: (name: string) => void
  readonly onUpgradeAll: (names: readonly string[]) => void
  /** The release page of the newer client, in the browser. */
  readonly onOpenRelease: () => void
}

/**
 * The settings dialog: the stores on this machine, the language, the view the window
 * opens with, and whether a newer client is out.
 *
 * A native `<dialog>`, kept in step with `state.settingsOpen`: the view opens and
 * closes it to match, and the dialog's own close — Escape, or the button — is reported
 * back as a callback rather than acted on, so the state stays the one place that says
 * whether it is up.
 */
export class SettingsView {
  private readonly dialog = requireElement('settings', HTMLDialogElement)
  private readonly title = requireElement('settings-title', HTMLElement)
  private readonly close = requireElement('settings-close', HTMLButtonElement)
  private readonly tabs: Readonly<Record<SettingsTab, HTMLButtonElement>> = {
    general: requireElement('settings-tab-general', HTMLButtonElement),
    stores: requireElement('settings-tab-stores', HTMLButtonElement),
    updates: requireElement('settings-tab-updates', HTMLButtonElement)
  }

  private readonly panels: Readonly<Record<SettingsTab, HTMLElement>> = {
    general: requireElement('settings-panel-general', HTMLElement),
    stores: requireElement('settings-panel-stores', HTMLElement),
    updates: requireElement('settings-panel-updates', HTMLElement)
  }

  private readonly stores = requireElement('settings-stores', HTMLElement)
  private readonly registryRow = requireElement('settings-registry-row', HTMLElement)
  private readonly registryLabel = requireElement('settings-registry-label', HTMLElement)
  private readonly registry = requireElement('settings-registry', HTMLSelectElement)
  private readonly registryAdd = requireElement('settings-registry-add', HTMLButtonElement)
  private readonly registryNote = requireElement('settings-registry-note', HTMLElement)
  private readonly customLabel = requireElement('settings-custom-label', HTMLElement)
  private readonly customUrl = requireElement('settings-custom-url', HTMLInputElement)
  private readonly customAdd = requireElement('settings-custom-add', HTMLButtonElement)
  private readonly customHint = requireElement('settings-custom-hint', HTMLElement)
  private readonly languageLabel = requireElement('settings-language-label', HTMLElement)
  private readonly locale = requireElement('locale', HTMLSelectElement)
  private readonly viewLabel = requireElement('settings-view-label', HTMLElement)
  private readonly viewMode = requireElement('view-mode', HTMLSelectElement)
  private readonly viewGrid = requireElement('view-mode-grid', HTMLOptionElement)
  private readonly viewList = requireElement('view-mode-list', HTMLOptionElement)
  private readonly versionHead = requireElement('settings-version-head', HTMLElement)
  private readonly version = requireElement('settings-version', HTMLElement)
  private readonly updateCheck = requireElement('update-check', HTMLButtonElement)
  private readonly updateState = requireElement('update-state', HTMLElement)
  private readonly updateOpen = requireElement('update-open', HTMLButtonElement)
  private readonly clientHead = requireElement('settings-client-head', HTMLElement)
  private readonly gamesHead = requireElement('settings-games-head', HTMLElement)
  private readonly gamesEmpty = requireElement('settings-games-empty', HTMLElement)
  private readonly upgradeAll = requireElement('upgrade-all', HTMLButtonElement)
  private readonly updates = requireElement('settings-updates', HTMLElement)

  public constructor (private readonly callbacks: SettingsViewCallbacks) {
    this.dialog.addEventListener('close', callbacks.onClose)
    this.close.addEventListener('click', (): void => { this.dialog.close() })
    for (const tab of SETTINGS_TABS) {
      this.tabs[tab].addEventListener('click', (): void => { callbacks.onSelectTab(tab) })
    }
    // Arrow keys walk the tabs, as a tab list is expected to; the focus follows.
    requireElement('settings-tabs', HTMLElement).addEventListener('keydown', (event: KeyboardEvent): void => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step === 0) return
      const current = SETTINGS_TABS.findIndex((tab: SettingsTab): boolean => this.tabs[tab] === document.activeElement)
      if (current < 0) return
      event.preventDefault()
      const next = SETTINGS_TABS[(current + step + SETTINGS_TABS.length) % SETTINGS_TABS.length] ?? 'general'
      this.tabs[next].focus()
      callbacks.onSelectTab(next)
    })
    this.registryAdd.addEventListener('click', (): void => { this.submitRegistry() })
    this.customAdd.addEventListener('click', (): void => { this.submitCustom() })
    // A single text field with a button beside it is a form, and a form that ignores
    // Enter is a small daily annoyance.
    this.customUrl.addEventListener('keydown', (event: KeyboardEvent): void => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      this.submitCustom()
    })
    this.locale.addEventListener('change', (): void => { callbacks.onSelectLocale(this.locale.value) })
    this.viewMode.addEventListener('change', (): void => {
      callbacks.onSelectViewMode(this.viewMode.value === 'list' ? 'list' : 'grid')
    })
    this.updateCheck.addEventListener('click', callbacks.onCheckForUpdates)
    this.updateOpen.addEventListener('click', callbacks.onOpenRelease)
    this.upgradeAll.addEventListener('click', (): void => {
      callbacks.onUpgradeAll([...this.updates.querySelectorAll<HTMLElement>('.settings-update')]
        .map((row: HTMLElement): string => row.dataset['name'] ?? '')
        .filter((name: string): boolean => name.length > 0))
    })
  }

  public render (state: AppState): void {
    const messages = state.messages
    setText(this.title, messages.settings)
    describeControl(this.close, messages.close)
    setText(this.tabs.general, messages.general)
    setText(this.tabs.stores, messages.stores)
    setText(this.tabs.updates, messages.updates)
    this.renderTabs(state)
    setText(this.registryLabel, messages.addStoreFromList)
    setText(this.registryAdd, messages.customAction)
    setText(this.customLabel, messages.customTitle)
    setText(this.customAdd, messages.customAction)
    setText(this.customHint, messages.customHint)
    setText(this.languageLabel, messages.language)
    setText(this.viewLabel, messages.defaultView)
    setText(this.viewGrid, messages.gridView)
    setText(this.viewList, messages.listView)
    setText(this.versionHead, messages.version)
    setText(this.version, state.appVersion)
    setText(this.clientHead, messages.clientUpdates)
    setText(this.gamesHead, messages.gameUpdates)
    setText(this.upgradeAll, messages.upgradeAll)

    this.renderStores(state)
    this.renderRegistry(state)
    this.renderLocales(state)
    this.viewMode.value = state.viewMode
    this.renderClientUpdate(state)
    this.renderGameUpdates(state)
    this.renderEnabled(state)
    this.renderOpen(state)
  }

  /** One tab is on and one panel is shown; the state says which. */
  private renderTabs (state: AppState): void {
    for (const tab of SETTINGS_TABS) {
      const active = tab === state.settingsTab
      this.tabs[tab].classList.toggle('is-active', active)
      this.tabs[tab].setAttribute('aria-selected', String(active))
      this.tabs[tab].tabIndex = active ? 0 : -1
      setHidden(this.panels[tab], !active)
    }
  }

  /**
   * The dialog follows the state, not the other way round.
   *
   * `close()` fires the dialog's `close` event, which reports back through `onClose`;
   * the state is already closed by then, so that round trip changes nothing. The typed
   * address is cleared on the way out: it belonged to this opening.
   */
  private renderOpen (state: AppState): void {
    if (state.settingsOpen && !this.dialog.open) this.dialog.showModal()
    if (!state.settingsOpen && this.dialog.open) this.dialog.close()
    if (!state.settingsOpen) this.customUrl.value = ''
  }

  /**
   * The store rows, rebuilt only when what they show has changed.
   *
   * Every log line and every busy flip re-renders the window, and a rename field that
   * was rebuilt under somebody's fingers would lose what they had typed. So the rows
   * carry a signature of what they were drawn from, and a render that would draw the
   * same thing leaves them alone; being enabled is applied separately, since that
   * changes on its own schedule.
   */
  private renderStores (state: AppState): void {
    const activeHome = state.currentStore?.home ?? null
    const signature = JSON.stringify([
      state.stores.map((store: InstalledStoreDto): readonly string[] =>
        [store.home, store.name, store.id, store.catalogUrl]),
      activeHome, state.renamingHome, state.locale
    ])
    if (this.stores.dataset['signature'] === signature) return
    this.stores.dataset['signature'] = signature

    this.stores.replaceChildren(...state.stores.map((store: InstalledStoreDto): HTMLElement => {
      const row = createElement('div', 'settings-store')
      if (store.home === activeHome) row.classList.add('is-active')
      row.title = store.home
      row.appendChild(store.home === state.renamingHome
        ? this.createRenameField(store, state)
        : this.createStoreText(store))
      if (store.home !== state.renamingHome) {
        const rename = createElement('button', 'icon-btn settings-store-rename-button')
        rename.appendChild(createIcon('pencil'))
        describeControl(rename, state.messages.renameStore)
        rename.addEventListener('click', (): void => { this.callbacks.onBeginRename(store.home) })
        row.appendChild(rename)

        const remove = createElement('button', 'icon-btn settings-store-remove')
        remove.appendChild(createIcon('trash'))
        describeControl(remove, state.messages.removeStore)
        remove.addEventListener('click', (): void => { this.callbacks.onRemoveStore(store.home, store.name) })
        row.appendChild(remove)
      }
      return row
    }))
    this.stores.querySelector<HTMLInputElement>('.settings-store-rename .input')?.select()
  }

  private createStoreText (store: InstalledStoreDto): HTMLElement {
    const text = createElement('div', 'settings-store-text')
    text.appendChild(createElement('span', 'settings-store-name', store.name))
    text.appendChild(createElement('span', 'settings-store-meta',
      store.catalogUrl.length > 0 ? `${store.id} · ${store.catalogUrl}` : store.id))
    return text
  }

  /** The name as a field, with Save and Cancel; Enter and Escape do the same. */
  private createRenameField (store: InstalledStoreDto, state: AppState): HTMLElement {
    const field = createElement('div', 'settings-store-text settings-store-rename')
    const input = createElement('input', 'input')
    input.type = 'text'
    input.value = store.name
    input.spellcheck = false
    const submit = (): void => {
      const value = input.value.trim()
      if (value.length === 0 || value === store.name) {
        this.callbacks.onCancelRename()
        return
      }
      this.callbacks.onRename(store.home, value)
    }
    input.addEventListener('keydown', (event: KeyboardEvent): void => {
      if (event.key === 'Enter') {
        event.preventDefault()
        submit()
      }
      if (event.key === 'Escape') {
        // Escape would otherwise close the dialog: here it only ends the rename.
        event.preventDefault()
        event.stopPropagation()
        this.callbacks.onCancelRename()
      }
    })
    field.appendChild(input)
    const save = createElement('button', 'btn btn-primary btn-tiny', state.messages.save)
    save.addEventListener('click', submit)
    field.appendChild(save)
    const cancel = createElement('button', 'btn btn-ghost btn-tiny', state.messages.cancel)
    cancel.addEventListener('click', this.callbacks.onCancelRename)
    field.appendChild(cancel)
    return field
  }

  /**
   * What the registry offers, minus what is already here.
   *
   * Three things can stand in the picker's place: nothing yet, because the registry has
   * not answered; a sentence, because it failed or everything it lists is installed; or
   * the list. The typed-address row is there in every case — that is the point of it.
   */
  private renderRegistry (state: AppState): void {
    const installed = new Set(state.stores.map((store: InstalledStoreDto): string => store.id))
    const offered = state.registry === null
      ? []
      : state.registry.stores.filter((store: RegistryStoreDto): boolean => !installed.has(store.storeId))

    const note = state.registry === null
      ? state.messages.registryLoading
      : state.registry.error !== null
        ? `${state.messages.registryFailed}: ${state.registry.error}`
        : offered.length === 0 ? state.messages.noRegistryStores : ''
    setHidden(this.registryRow, offered.length === 0)
    setHidden(this.registryNote, note.length === 0)
    setText(this.registryNote, note)

    const signature = JSON.stringify(offered.map((store: RegistryStoreDto): string => store.catalogUrl))
    if (this.registry.dataset['signature'] === signature) return
    this.registry.dataset['signature'] = signature
    // The option names the catalog, which is what a registry record is identified by;
    // the controller finds the record in the state from it.
    this.registry.replaceChildren(...offered.map((store: RegistryStoreDto): HTMLOptionElement => {
      const option = createElement('option', undefined, store.name)
      option.value = store.catalogUrl
      return option
    }))
  }

  private submitRegistry (): void {
    if (this.registry.value.length === 0) return
    this.callbacks.onAddStore(this.registry.value)
  }

  private submitCustom (): void {
    const value = this.customUrl.value.trim()
    if (value.length === 0) return
    this.callbacks.onAddCatalog(value)
  }

  private renderLocales (state: AppState): void {
    if (this.locale.value === state.locale && this.locale.options.length === state.locales.length) return
    this.locale.replaceChildren(...state.locales.map((locale: Locale): HTMLOptionElement => {
      const option = createElement('option', undefined, locale.toUpperCase())
      option.value = locale
      option.selected = locale === state.locale
      return option
    }))
  }

  /**
   * The version, and whether a newer one is published.
   *
   * Nothing is said until asked: the button is the whole of it at first, the sentence
   * and the download button appear with an answer. A failed check says so in the same
   * place rather than in the log alone — the person clicked here and is looking here.
   */
  private renderClientUpdate (state: AppState): void {
    const update = state.clientUpdate
    setText(this.updateCheck, update?.phase === 'checking'
      ? state.messages.checkingForUpdates
      : state.messages.checkForUpdates)
    this.updateCheck.disabled = update?.phase === 'checking'

    const available = update?.phase === 'checked' && update.result.updateAvailable
    setHidden(this.updateState, update === null || update.phase === 'checking')
    setHidden(this.updateOpen, !available)
    if (update === null || update.phase === 'checking') return

    if (update.phase === 'failed') {
      setText(this.updateState, state.messages.updateCheckFailed)
      return
    }
    setText(this.updateState, available
      ? state.messages.clientUpdateAvailable.replace('%{version}', update.result.latestVersion)
      : state.messages.clientUpToDate)
    setText(this.updateOpen, state.messages.downloadUpdate.replace('%{version}', update.result.latestVersion))
  }

  /**
   * The titles the catalog has a newer version of, one row each, and a way to take them
   * all at once. The rows are the same titles the Updates filter shows; this is that
   * list where somebody looking for updates would look for it.
   */
  private renderGameUpdates (state: AppState): void {
    const behind = state.games.filter((game: GameDto): boolean => game.updateAvailable)
    setHidden(this.gamesEmpty, behind.length > 0)
    setText(this.gamesEmpty, state.messages.upToDate)
    setHidden(this.upgradeAll, behind.length < 2)

    const signature = JSON.stringify([
      behind.map((game: GameDto): readonly string[] => [game.name, game.title, game.installedVersion ?? '', game.version]),
      state.locale
    ])
    if (this.updates.dataset['signature'] === signature) return
    this.updates.dataset['signature'] = signature

    this.updates.replaceChildren(...behind.map((game: GameDto): HTMLElement => {
      const row = createElement('div', 'settings-update')
      row.dataset['name'] = game.name
      row.appendChild(createElement('span', 'settings-update-title', game.title))
      const versions = createElement('span', 'settings-update-versions', `${game.installedVersion ?? '?'} → `)
      versions.appendChild(createElement('b', undefined, game.version))
      row.appendChild(versions)
      const upgrade = createElement('button', 'btn btn-secondary btn-tiny', state.messages.upgrade)
      upgrade.addEventListener('click', (): void => { this.callbacks.onUpgrade(game.name) })
      row.appendChild(upgrade)
      return row
    }))
  }

  /**
   * While the store is working, only what would start a second call is disabled: adding,
   * renaming, removing and upgrading. The language, the view and the update check touch
   * no store.
   */
  private renderEnabled (state: AppState): void {
    this.registryAdd.disabled = state.busy
    this.customAdd.disabled = state.busy
    this.upgradeAll.disabled = state.busy
    for (const button of this.stores.querySelectorAll('button')) button.disabled = state.busy
    for (const button of this.updates.querySelectorAll('button')) button.disabled = state.busy
  }
}
