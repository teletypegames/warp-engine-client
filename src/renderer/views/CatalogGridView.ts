import type { GameDto } from '../../shared/contracts/dto/GameDto'
import { closeDetailsOnOutsideClick, requireElement } from '../dom/Dom'
import type { AppState } from '../state/AppStore'
import { nearEnd, renderListing } from './Listing'
import type { GameCardView } from './GameCardView'

/** The grid of cards; on screen while there is no gate and the view mode says grid. */
export class CatalogGridView {
  private readonly grid = requireElement('grid', HTMLElement)
  private readonly empty = requireElement('empty', HTMLElement)

  public constructor (
    private readonly cards: GameCardView,
    private readonly onMore: () => void
  ) {
    closeDetailsOnOutsideClick(this.grid, 'details.menu')
    this.grid.addEventListener('scroll', (): void => {
      if (nearEnd(this.grid)) this.onMore()
    }, { passive: true })
  }

  public render (state: AppState): void {
    renderListing(this.grid, this.empty, state, state.viewMode === 'grid',
      (game: GameDto): HTMLElement => this.cards.createCard(game, state.messages, state.busy),
      this.onMore)
  }
}
