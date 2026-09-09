import type { GameDto } from '../../shared/contracts/dto/GameDto'
import { setHidden, setText } from '../dom/Dom'
import type { AppState } from '../state/AppStore'
import { matchesFilter } from '../state/CatalogFilter'

/**
 * What the grid and the list have in common: whether to be on screen at all, which
 * titles to show, and the sentence that stands in for them when there are none.
 *
 * Both listings share the one `#empty` element. While the gate is up neither draws and
 * the sentence goes too; otherwise the listing that matches the view mode owns it for
 * that render, and the other one only stands down.
 */
export function renderListing (
  container: HTMLElement,
  empty: HTMLElement,
  state: AppState,
  active: boolean,
  createEntry: (game: GameDto) => HTMLElement
): void {
  if (state.gate !== null) {
    setHidden(container, true)
    setHidden(empty, true)
    return
  }
  if (!active) {
    setHidden(container, true)
    return
  }
  const games = state.games.filter((game: GameDto): boolean => matchesFilter(game, state.filter))
  container.replaceChildren(...games.map(createEntry))
  setHidden(container, games.length === 0)
  container.scrollTop = 0
  setHidden(empty, games.length !== 0)
  setText(empty, state.games.length === 0 ? state.messages.noGames : state.messages.noMatch)
}
