import type { RegistryStoreDto } from '../../shared/contracts/dto/RegistryStoreDto'
import { createElement, requireElement, setHidden, setText } from '../dom/Dom'
import type { MessageBundle } from '../../shared/i18n/MessageBundle'

/** A button on the gate, and what choosing it does. */
export interface GateAction {
  readonly label: string
  readonly perform: (chosen: RegistryStoreDto | null) => void
}

export interface GateLink {
  readonly label: string
  readonly url: string
}

export interface GatePresentation {
  readonly title: string
  readonly body: string
  readonly action?: GateAction
  readonly link?: GateLink
  readonly choices?: readonly RegistryStoreDto[]
}

/**
 * The screen shown instead of the grid when there is nothing to drive: no Python, no
 * store yet, an engine too old, or a registry that cannot be reached.
 */
export class GateView {
  private readonly section = requireElement('gate', HTMLElement)
  private readonly title = requireElement('gate-title', HTMLElement)
  private readonly body = requireElement('gate-body', HTMLElement)
  private readonly choice = requireElement('gate-choice', HTMLElement)
  private readonly choiceLabel = requireElement('gate-choice-label', HTMLElement)
  private readonly select = requireElement('gate-select', HTMLSelectElement)
  private readonly button = requireElement('gate-action', HTMLButtonElement)
  private readonly link = requireElement('gate-link', HTMLAnchorElement)

  public constructor (private readonly onOpenUrl: (url: string) => void) {}

  public show (presentation: GatePresentation, messages: MessageBundle): void {
    setHidden(this.section, false)
    setText(this.title, presentation.title)
    setText(this.body, presentation.body)
    this.renderChoices(presentation.choices ?? [], messages)
    this.renderAction(presentation)
    this.renderLink(presentation.link ?? null)
  }

  public hide (): void {
    setHidden(this.section, true)
  }

  public get visible (): boolean {
    return !this.section.hidden
  }

  /** Only shown when the registry offers more than one store; with a single one there is nothing to decide. */
  private renderChoices (choices: readonly RegistryStoreDto[], messages: MessageBundle): void {
    setHidden(this.choice, choices.length < 2)
    if (choices.length < 2) return
    setText(this.choiceLabel, messages.setupChoose)
    this.select.replaceChildren(...choices.map((store: RegistryStoreDto, index: number): HTMLOptionElement => {
      const option = createElement('option', undefined, store.name)
      option.value = String(index)
      return option
    }))
  }

  private renderAction (presentation: GatePresentation): void {
    const action = presentation.action
    setHidden(this.button, action === undefined)
    this.button.disabled = false
    if (action === undefined) return
    setText(this.button, action.label)
    this.button.onclick = (): void => {
      const choices = presentation.choices ?? []
      const index = Number(this.select.value)
      action.perform(choices[Number.isFinite(index) ? index : 0] ?? choices[0] ?? null)
    }
  }

  private renderLink (link: GateLink | null): void {
    setHidden(this.link, link === null)
    if (link === null) return
    setText(this.link, link.label)
    this.link.onclick = (event: MouseEvent): void => {
      event.preventDefault()
      this.onOpenUrl(link.url)
    }
  }
}
