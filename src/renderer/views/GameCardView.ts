import type { GameDto } from '../../shared/contracts/dto/GameDto'
import type { MessageBundle } from '../../shared/i18n/MessageBundle'
import { createElement } from '../dom/Dom'

export interface GameCardViewCallbacks {
  readonly onInstall: (name: string) => void
  readonly onUpgrade: (name: string) => void
  readonly onLaunch: (name: string) => void
  readonly onRemove: (name: string) => void
  /** Opens the catalog's own purchase page in the person's browser. */
  readonly onPurchase: (name: string) => void
  readonly onSignIn: () => void
}

/**
 * One card.
 *
 * A card is a function of a title and the strings: it holds no state of its own, so the
 * grid can throw the lot away and rebuild after every listing. The one exception is the
 * actions menu, whose open/closed state lives in a `<details>` element — and being
 * thrown away is exactly what should happen to an open menu when the catalog changes
 * under it.
 */
export class GameCardView {
  public constructor (private readonly callbacks: GameCardViewCallbacks) {}

  public createCard (game: GameDto, messages: MessageBundle, busy: boolean): HTMLElement {
    const card = createElement('article', 'card')
    if (game.installed) card.classList.add('is-installed')
    if (!game.installable) card.classList.add('is-unavailable')
    if (game.accessVerdict === 'purchasable') card.classList.add('is-purchasable')
    card.appendChild(this.createArt(game))
    card.appendChild(this.createBody(game, messages, busy))
    return card
  }

  private createArt (game: GameDto): HTMLElement {
    const art = createElement('div', 'art')
    if (game.imageUrl !== null) {
      const image = createElement('img')
      image.src = game.imageUrl
      image.alt = ''
      image.loading = 'lazy'
      art.appendChild(image)
      return art
    }
    // No box art in the catalog: the first letter, on the same band an image would
    // fill, so a row of cards stays aligned either way.
    art.appendChild(createElement('span', 'art-glyph', game.title.slice(0, 1).toUpperCase()))
    return art
  }

  private createBody (game: GameDto, messages: MessageBundle, busy: boolean): HTMLElement {
    const body = createElement('div', 'body')
    body.appendChild(createElement('h2', undefined, game.title))
    body.appendChild(this.createMeta(game, messages))
    if (game.description.length > 0) {
      body.appendChild(createElement('p', 'desc', game.description))
    }
    body.appendChild(this.createActions(game, messages, busy))
    return body
  }

  private createMeta (game: GameDto, messages: MessageBundle): HTMLElement {
    const meta = createElement('div', 'meta')
    if (game.installable) {
      const mode = createElement('span', `badge badge-${game.mode}`,
        game.mode === 'web' ? messages.hosted : messages.native)
      mode.title = game.mode === 'web' ? messages.hostedHint : messages.nativeHint
      meta.appendChild(mode)
    } else {
      // Which of the two it is matters: a platform this store does not carry is a
      // different disappointment from a game with no build for your machine.
      const label = game.unavailableReason === 'platformOff'
        ? messages.unsupportedPlatform
        : messages.unsupportedBuild
      const badge = createElement('span', 'badge badge-unavailable', label)
      badge.title = game.unavailableDetail ?? label
      meta.appendChild(badge)
    }
    meta.appendChild(createElement('span', 'badge badge-plain', game.platform))
    // The price is where the mode badge is rather than down by the button: what a title
    // costs is something a person scans a grid for, and a number that only appears
    // beside a button is a number they have to hunt for card by card.
    if (game.priceLabel !== null && game.accessVerdict !== 'entitled') {
      meta.appendChild(createElement('span', 'badge badge-price', game.priceLabel))
    }
    if (game.accessVerdict === 'entitled') {
      const owned = createElement('span', 'badge badge-owned', messages.owned)
      owned.title = messages.ownedHint
      meta.appendChild(owned)
    }
    meta.appendChild(this.createVersion(game, messages))
    return meta
  }

  /**
   * The version, and what the catalog has that this machine does not.
   *
   * Both numbers, when they differ: which version is installed is the thing a person
   * came to the card to find out, and "there is a newer one" is only meaningful next to
   * it. Where they agree, the second number would be noise.
   */
  private createVersion (game: GameDto, messages: MessageBundle): HTMLElement {
    if (!game.installed || game.installedVersion === null) {
      return createElement('span', 'version', game.version)
    }
    if (!game.updateAvailable) {
      return createElement('span', 'version', `${game.installedVersion} · ${messages.installed}`)
    }
    const version = createElement('span', 'version has-update',
      `${game.installedVersion} → ${game.version}`)
    version.title = messages.updateAvailable
    return version
  }

  private createActions (game: GameDto, messages: MessageBundle, busy: boolean): HTMLElement {
    const actions = createElement('div', 'actions')

    // Nothing to offer, so nothing to press: a disabled Install would invite a click
    // that can never work. The badge above says why.
    if (!game.installable) {
      actions.appendChild(createElement('span', 'actions-note',
        game.unavailableDetail ?? messages.unsupportedPlatform))
      return actions
    }

    // Not yours yet: the card sells rather than installs. Deliberately a live button
    // and not a dimmed one — the dimmed treatment above is for what this *machine*
    // cannot do, and there is nothing wrong with this machine.
    if (!game.installed && game.accessVerdict === 'purchasable') {
      actions.appendChild(this.createPurchase(game, messages, busy))
      return actions
    }
    // The catalog would know, if it knew who was asking.
    if (!game.installed && game.accessVerdict === 'signInRequired') {
      actions.appendChild(this.createSignIn(messages, busy))
      return actions
    }

    actions.appendChild(this.createPrimary(game, messages, busy))
    // Only an installed title has anything in the menu: nothing to upgrade and nothing
    // to uninstall until there is something on the disk.
    if (game.installed) actions.appendChild(this.createMenu(game, messages, busy))
    return actions
  }

  /**
   * Buy it — which happens in a browser, not here.
   *
   * Payment is the store's business and its own web pages already do it; a checkout
   * rebuilt in this window would be a second place to get card handling wrong. After
   * buying, Refresh is what turns the card into an Install.
   */
  private createPurchase (game: GameDto, messages: MessageBundle, busy: boolean): HTMLElement {
    const button = createElement('button', 'btn btn-primary btn-purchase')
    button.textContent = game.priceLabel === null
      ? messages.purchase
      : `${messages.purchase} · ${game.priceLabel}`
    button.disabled = busy || game.purchaseUrl === null
    button.title = messages.purchaseHint
    button.addEventListener('click', (): void => { this.callbacks.onPurchase(game.name) })
    return button
  }

  private createSignIn (messages: MessageBundle, busy: boolean): HTMLElement {
    const button = createElement('button', 'btn btn-secondary')
    button.textContent = messages.signInToInstall
    button.disabled = busy
    button.title = messages.signInToInstallHint
    button.addEventListener('click', (): void => { this.callbacks.onSignIn() })
    return button
  }

  /**
   * The one action a card leads with.
   *
   * For an installed title that is playing it — including when an upgrade is waiting,
   * because the version on the disk still runs and wanting to play it is not the same
   * as wanting to wait for a download.
   */
  private createPrimary (game: GameDto, messages: MessageBundle, busy: boolean): HTMLElement {
    const primary = createElement('button', 'btn btn-primary')
    if (game.installed) {
      primary.textContent = game.mode === 'web' ? messages.open : messages.play
      primary.disabled = busy || !game.launchable
      primary.addEventListener('click', (): void => { this.callbacks.onLaunch(game.name) })
      return primary
    }
    primary.textContent = messages.install
    primary.disabled = busy
    primary.addEventListener('click', (): void => { this.callbacks.onInstall(game.name) })
    return primary
  }

  /**
   * The three-dot menu: upgrade, and uninstall.
   *
   * A `<details>` rather than a scripted popover, so the open state is the DOM's and the
   * keyboard works without being taught to. Upgrade is present but disabled when there
   * is nothing newer — a menu whose items appear and disappear makes a person hunt for
   * the one they used last time, and "greyed out" already says "not now".
   */
  private createMenu (game: GameDto, messages: MessageBundle, busy: boolean): HTMLElement {
    const menu = createElement('details', 'menu')
    const toggle = createElement('summary', 'icon-btn menu-toggle')
    toggle.title = messages.moreActions
    toggle.setAttribute('aria-label', messages.moreActions)
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

  private createMenuItem (
    label: string,
    disabled: boolean,
    perform: () => void
  ): HTMLButtonElement {
    const item = createElement('button', 'menu-item', label)
    item.disabled = disabled
    item.addEventListener('click', (): void => {
      // Close before acting: the click starts work that re-renders the grid, and a menu
      // left open would vanish mid-gesture rather than answer the press.
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
