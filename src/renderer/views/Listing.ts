import type { GameDto } from '../../shared/contracts/dto/GameDto'
import { setHidden, setText } from '../dom/Dom'
import type { AppState } from '../state/AppStore'
import { matchesFilter } from '../state/CatalogFilter'

/** How close to the bottom, in pixels, counts as "nearing the end". */
export const NEAR_END_PX = 600

/**
 * What the grid and the list have in common: whether to be on screen at all, which
 * titles to show, and the sentence that stands in for them when there are none.
 *
 * Both listings share the one `#empty` element. While the gate is up neither draws and
 * the sentence goes too; otherwise the listing that matches the view mode owns it for
 * that render, and the other one only stands down.
 *
 * The listing is windowed: it draws `state.visibleCount` of the filtered titles and asks
 * for more through `onMore` when what it drew does not even fill the container, so a
 * tall window on a short first page is not left half empty. Scrolling near the end asks
 * for more as well — that listener is the view's, since it is about its own element.
 */
export function renderListing (
  container: HTMLElement,
  empty: HTMLElement,
  state: AppState,
  active: boolean,
  createEntry: (game: GameDto) => HTMLElement,
  onMore: () => void
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
  const shown = games.slice(0, state.visibleCount)
  container.replaceChildren(...shown.map(createEntry))
  setHidden(container, games.length === 0)
  rememberScroll(container, state)
  setHidden(empty, games.length !== 0)
  setText(empty, state.games.length === 0 ? state.messages.noGames : state.messages.noMatch)

  if (shown.length < games.length && container.scrollHeight <= container.clientHeight + 1) onMore()
}

/** True when the element is scrolled to within `NEAR_END_PX` of its bottom. */
export function nearEnd (container: HTMLElement): boolean {
  return container.scrollTop + container.clientHeight >= container.scrollHeight - NEAR_END_PX
}

/**
 * Scroll back to the top only when the list is a different list — another store, another
 * filter, another view — and not when the same list grew by a page or a screenful. This
 * is a render-time memory of what was last drawn, not application state: nothing decides
 * anything on it, it only stops the grid jumping under somebody's hand.
 */
const lastDrawn = new WeakMap<HTMLElement, string>()

function rememberScroll (container: HTMLElement, state: AppState): void {
  const key = `${state.currentStore?.home ?? ''}|${state.viewMode}|${JSON.stringify(state.filter)}`
  if (lastDrawn.get(container) === key) return
  lastDrawn.set(container, key)
  container.scrollTop = 0
}
