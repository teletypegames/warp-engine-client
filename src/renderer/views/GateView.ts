import type { RegistryStoreDto } from '../../shared/contracts/dto/RegistryStoreDto'
import { createElement, requireElement, setHidden, setText } from '../dom/Dom'
import type { MessageBundle } from '../../shared/i18n/MessageBundle'
import type { GateCustom, GateLink, GatePresentation } from '../state/GatePresentation'

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
  private readonly cancel = requireElement('gate-cancel', HTMLButtonElement)
  private readonly link = requireElement('gate-link', HTMLAnchorElement)
  private readonly custom = requireElement('gate-custom', HTMLElement)
  private readonly customLabel = requireElement('gate-custom-label', HTMLElement)
  private readonly customUrl = requireElement('gate-custom-url', HTMLInputElement)
  private readonly customAction = requireElement('gate-custom-action', HTMLButtonElement)
  private readonly customHint = requireElement('gate-custom-hint', HTMLElement)

  public constructor (private readonly onOpenUrl: (url: string) => void) {}

  public show (presentation: GatePresentation, messages: MessageBundle): void {
    setHidden(this.section, false)
    setText(this.title, presentation.title)
    setText(this.body, presentation.body)
    this.renderChoices(presentation.choices ?? [], messages)
    this.renderAction(presentation)
    this.renderCancel(presentation)
    this.renderCustom(presentation.custom ?? null)
    this.renderLink(presentation.link ?? null)
  }

  public hide (): void {
    setHidden(this.section, true)
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

  private renderCancel (presentation: GatePresentation): void {
    const cancel = presentation.cancel
    setHidden(this.cancel, cancel === undefined)
    if (cancel === undefined) return
    setText(this.cancel, cancel.label)
    this.cancel.onclick = (): void => { cancel.perform(null) }
  }

  /**
   * The typed-address row.
   *
   * Enter submits as well as the button, because a single text field with a button
   * beside it is a form, and a form that ignores Enter is a small daily annoyance.
   */
  private renderCustom (custom: GateCustom | null): void {
    setHidden(this.custom, custom === null)
    if (custom === null) return
    setText(this.customLabel, custom.label)
    setText(this.customHint, custom.hint)
    setText(this.customAction, custom.actionLabel)

    const submit = (): void => {
      const value = this.customUrl.value.trim()
      if (value.length === 0) return
      custom.perform(value)
    }
    this.customAction.onclick = submit
    this.customUrl.onkeydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      submit()
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
