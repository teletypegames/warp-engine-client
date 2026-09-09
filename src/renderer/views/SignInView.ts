import { requireElement, setHidden, setText } from '../dom/Dom'
import type { AppState } from '../state/AppStore'

export interface SignInViewCallbacks {
  readonly onOpenPage: () => void
  readonly onCancel: () => void
}

/**
 * The code, while somebody takes it to a browser.
 *
 * A panel over the catalog rather than a screen of its own: the sign-in is happening
 * somewhere else, and there is no reason this window should stop being useful while it
 * does. Everything on it is one of three things — the code, a way back to the page for
 * whoever closed the tab, and a way out.
 */
export class SignInView {
  private readonly panel = requireElement('signin', HTMLElement)
  private readonly title = requireElement('signin-title', HTMLElement)
  private readonly body = requireElement('signin-body', HTMLElement)
  private readonly code = requireElement('signin-code', HTMLElement)
  private readonly waiting = requireElement('signin-waiting', HTMLElement)
  private readonly openPage = requireElement('signin-open', HTMLButtonElement)
  private readonly cancel = requireElement('signin-cancel', HTMLButtonElement)

  public constructor (callbacks: SignInViewCallbacks) {
    this.openPage.addEventListener('click', callbacks.onOpenPage)
    this.cancel.addEventListener('click', callbacks.onCancel)
  }

  public render (state: AppState): void {
    const prompt = state.signIn
    if (prompt === null) {
      setHidden(this.panel, true)
      return
    }

    const storeName = state.currentStore?.name ?? state.messages.appName
    setText(this.title, state.messages.signInTitle.replace('%{store}', storeName))
    setText(this.body, state.messages.signInBody)
    setText(this.code, prompt.userCode)
    setText(this.waiting, state.messages.signInWaiting)
    setText(this.openPage, state.messages.signInOpenAgain)
    setText(this.cancel, state.messages.signInCancel)
    setHidden(this.panel, false)
  }
}
