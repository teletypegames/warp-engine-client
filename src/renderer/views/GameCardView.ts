import type { GameDto } from '../../shared/contracts/dto/GameDto'
import type { MessageBundle } from '../../shared/i18n/MessageBundle'
import { createElement } from '../dom/Dom'

export interface GameCardViewCallbacks {
  readonly onInstall: (name: string) => void
  readonly onLaunch: (name: string) => void
  readonly onRemove: (name: string) => void
}

/**
 * One card.
 *
 * A card is a function of a title and the strings: it holds no state of its own, so
 * the grid can throw the lot away and rebuild after every listing.
 */
export class GameCardView {
  public constructor (private readonly callbacks: GameCardViewCallbacks) {}

  public createCard (game: GameDto, messages: MessageBundle, busy: boolean): HTMLElement {
    const card = createElement('article', 'card')
    if (game.installed) card.classList.add('is-installed')
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
    const mode = createElement('span', `badge badge-${game.mode}`,
      game.mode === 'web' ? messages.hosted : messages.native)
    mode.title = game.mode === 'web' ? messages.hostedHint : messages.nativeHint
    meta.appendChild(mode)
    meta.appendChild(createElement('span', 'badge badge-plain', game.platform))
    meta.appendChild(createElement('span', 'version',
      game.installed && game.installedVersion !== null
        ? `${game.installedVersion} · ${messages.installed}`
        : game.version))
    return meta
  }

  private createActions (game: GameDto, messages: MessageBundle, busy: boolean): HTMLElement {
    const actions = createElement('div', 'actions')
    const primary = createElement('button', 'btn btn-primary')
    primary.disabled = busy

    if (game.installed && !game.updateAvailable) {
      primary.textContent = game.mode === 'web' ? messages.open : messages.play
      primary.disabled = busy || !game.launchable
      primary.addEventListener('click', (): void => { this.callbacks.onLaunch(game.name) })
    } else {
      primary.textContent = game.updateAvailable ? messages.update : messages.install
      primary.addEventListener('click', (): void => { this.callbacks.onInstall(game.name) })
    }
    actions.appendChild(primary)

    if (game.installed) {
      const remove = createElement('button', 'btn btn-ghost', messages.remove)
      remove.disabled = busy
      remove.addEventListener('click', (): void => { this.callbacks.onRemove(game.name) })
      actions.appendChild(remove)
    }
    return actions
  }
}
