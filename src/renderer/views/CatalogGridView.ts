import type { GameDto } from '../../shared/contracts/dto/GameDto'
import { requireElement, setHidden, setText } from '../dom/Dom'
import type { AppState } from '../state/AppStore'
import { matchesFilter } from '../state/CategoryFilter'
import type { GameCardView } from './GameCardView'

/** The grid, and the sentence that stands in for it when there is nothing to show. */
export class CatalogGridView {
  private readonly grid = requireElement('grid', HTMLElement)
  private readonly empty = requireElement('empty', HTMLElement)

  public constructor (private readonly cards: GameCardView) {}

  public render (state: AppState): void {
    const shown = state.games.filter((game: GameDto): boolean => matchesFilter(game, state.filter))
    this.grid.replaceChildren(...shown.map((game: GameDto): HTMLElement =>
      this.cards.createCard(game, state.messages, state.busy)))
    setHidden(this.grid, shown.length === 0)
    this.grid.scrollTop = 0
    setHidden(this.empty, shown.length !== 0)
    setText(this.empty, state.games.length === 0 ? state.messages.noGames : state.messages.noMatch)
  }

  public hide (): void {
    setHidden(this.grid, true)
    setHidden(this.empty, true)
  }
}
