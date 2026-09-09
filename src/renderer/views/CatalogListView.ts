import type { GameDto } from '../../shared/contracts/dto/GameDto'
import type { MessageBundle } from '../../shared/i18n/MessageBundle'
import { createElement, describeControl, requireElement, setHidden, setText } from '../dom/Dom'
import type { AppState } from '../state/AppStore'
import { matchesFilter } from '../state/CatalogFilter'
import type { GameCardViewCallbacks } from './GameCardView'

/** The catalog as a flat list of rows instead of a grid of cards. */
export class CatalogListView {
  private readonly list = requireElement('catalog-list', HTMLElement)
  private readonly empty = requireElement('empty', HTMLElement)

  public constructor (private readonly callbacks: GameCardViewCallbacks) {
    this.closeMenusOnOutsideClick()
  }

  private closeMenusOnOutsideClick (): void {
    document.addEventListener('click', (event: MouseEvent): void => {
      const target = event.target
      const clicked = target instanceof Node ? target : null
      for (const menu of this.list.querySelectorAll('details.menu[open]')) {
        if (clicked === null || !menu.contains(clicked)) menu.removeAttribute('open')
      }
    })
  }

  public render (state: AppState): void {
    const shown = state.games.filter((game: GameDto): boolean => matchesFilter(game, state.filter))
    this.list.replaceChildren(...shown.map((game: GameDto): HTMLElement =>
      this.createRow(game, state.messages, state.busy)))
    setHidden(this.list, shown.length === 0)
    this.list.scrollTop = 0
    setHidden(this.empty, shown.length !== 0)
    setText(this.empty, state.games.length === 0 ? state.messages.noGames : state.messages.noMatch)
  }

  public hide (): void {
    setHidden(this.list, true)
    setHidden(this.empty, true)
  }

  private createRow (game: GameDto, messages: MessageBundle, busy: boolean): HTMLElement {
    const row = createElement('div', 'list-row')
    if (game.installed) row.classList.add('is-installed')
    if (!game.installable) row.classList.add('is-unavailable')

    row.appendChild(this.createArt(game))
    row.appendChild(createElement('span', 'title', game.title))
    row.appendChild(this.createMeta(game, messages))
    row.appendChild(this.createVersion(game, messages))
    row.appendChild(this.createActions(game, messages, busy))
    return row
  }

  private createArt (game: GameDto): HTMLElement {
    const art = createElement('div', 'art')
    if (game.imageUrl !== null) {
      const image = createElement('img')
      image.src = game.imageUrl
      image.alt = ''
      image.loading = 'lazy'
      art.appendChild(image)
    } else {
      art.appendChild(createElement('span', 'art-glyph', game.title.slice(0, 1).toUpperCase()))
    }
    return art
  }

  private createMeta (game: GameDto, messages: MessageBundle): HTMLElement {
    const meta = createElement('div', 'meta')
    meta.appendChild(createElement('span', 'badge badge-plain', game.platformLabel))
    if (game.installable) {
      meta.appendChild(createElement('span', `badge badge-${game.mode}`,
        game.mode === 'web' ? messages.hosted : messages.native))
    }
    return meta
  }

  private createVersion (game: GameDto, messages: MessageBundle): HTMLElement {
    if (!game.installed || game.installedVersion === null) {
      return createElement('span', 'version', game.version)
    }
    if (!game.updateAvailable) {
      return createElement('span', 'version', game.installedVersion)
    }
    const version = createElement('span', 'version has-update',
      `${game.installedVersion} → ${game.version}`)
    version.title = messages.updateAvailable
    return version
  }

  private createActions (game: GameDto, messages: MessageBundle, busy: boolean): HTMLElement {
    const actions = createElement('div', 'actions')

    if (!game.installable) return actions

    if (!game.installed && game.accessVerdict === 'purchasable') {
      const btn = createElement('button', 'btn btn-primary btn-tiny')
      btn.textContent = messages.purchase
      btn.disabled = busy || game.purchaseUrl === null
      btn.addEventListener('click', (): void => { this.callbacks.onPurchase(game.name) })
      actions.appendChild(btn)
      return actions
    }
    if (!game.installed && game.accessVerdict === 'signInRequired') {
      const btn = createElement('button', 'btn btn-secondary btn-tiny')
      btn.textContent = messages.signInToInstall
      btn.disabled = busy
      btn.addEventListener('click', (): void => { this.callbacks.onSignIn() })
      actions.appendChild(btn)
      return actions
    }

    if (game.installed) {
      const launch = createElement('button', 'btn btn-primary btn-tiny')
      launch.textContent = game.mode === 'web' ? messages.open : messages.play
      launch.disabled = busy || !game.launchable
      launch.addEventListener('click', (): void => { this.callbacks.onLaunch(game.name) })
      actions.appendChild(launch)
      actions.appendChild(this.createMenu(game, messages, busy))
    } else {
      const install = createElement('button', 'btn btn-primary btn-tiny')
      install.textContent = messages.install
      install.disabled = busy
      install.addEventListener('click', (): void => { this.callbacks.onInstall(game.name) })
      actions.appendChild(install)
    }
    return actions
  }

  private createMenu (game: GameDto, messages: MessageBundle, busy: boolean): HTMLElement {
    const menu = createElement('details', 'menu')
    const toggle = createElement('summary', 'icon-btn menu-toggle')
    describeControl(toggle, messages.moreActions)
    toggle.appendChild(this.createDotsIcon())
    menu.appendChild(toggle)

    const items = createElement('div', 'menu-items')
    items.appendChild(this.createMenuItem(messages.upgrade, busy || !game.updateAvailable,
      (): void => { this.callbacks.onUpgrade(game.name) }))
    items.appendChild(this.createMenuItem(messages.uninstall, busy,
      (): void => { this.callbacks.onRemove(game.name) }))
    menu.appendChild(items)
    return menu
  }

  private createMenuItem (label: string, disabled: boolean, perform: () => void): HTMLButtonElement {
    const item = createElement('button', 'menu-item', label)
    item.disabled = disabled
    item.addEventListener('click', (): void => {
      item.closest('details')?.removeAttribute('open')
      perform()
    })
    return item
  }

  private createDotsIcon (): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'icon icon-dots')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')
    for (const y of [3.5, 8, 12.5]) {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('cx', '8')
      dot.setAttribute('cy', String(y))
      dot.setAttribute('r', '1.35')
      svg.appendChild(dot)
    }
    return svg
  }
}
