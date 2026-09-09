import type { GameDto } from '../../shared/contracts/dto/GameDto'
import type { MessageBundle } from '../../shared/i18n/MessageBundle'
import { closeDetailsOnOutsideClick, createElement, requireElement } from '../dom/Dom'
import type { AppState } from '../state/AppStore'
import { renderListing } from './CatalogListing'
import type { GameCardView } from './GameCardView'

/**
 * The catalog as a flat list of rows instead of a grid of cards.
 *
 * A row is the card's pieces laid out sideways: the art, the version and the actions
 * come from `GameCardView`, so the two views cannot say different things about a title.
 */
export class CatalogListView {
  private readonly list = requireElement('catalog-list', HTMLElement)
  private readonly empty = requireElement('empty', HTMLElement)

  public constructor (private readonly cards: GameCardView) {
    closeDetailsOnOutsideClick(this.list, 'details.menu')
  }

  public render (state: AppState): void {
    renderListing(this.list, this.empty, state, state.viewMode === 'list',
      (game: GameDto): HTMLElement => this.createRow(game, state.messages, state.busy))
  }

  private createRow (game: GameDto, messages: MessageBundle, busy: boolean): HTMLElement {
    const row = createElement('div', 'list-row')
    if (game.installed) row.classList.add('is-installed')
    if (!game.installable) row.classList.add('is-unavailable')

    row.appendChild(this.cards.createArt(game))
    row.appendChild(createElement('span', 'title', game.title))
    row.appendChild(this.createMeta(game, messages))
    row.appendChild(this.cards.createVersion(game, messages, true))
    row.appendChild(this.cards.createCompactActions(game, messages, busy))
    return row
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
}
