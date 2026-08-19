import type { RegistryStoreDto } from '../../shared/contracts/dto/RegistryStoreDto'

/** A button on the gate, and what choosing it does. */
export interface GateAction {
  readonly label: string
  readonly perform: (chosen: RegistryStoreDto | null) => void
}

export interface GateLink {
  readonly label: string
  readonly url: string
}

/** A catalog typed rather than chosen. Absent where typing one makes no sense. */
export interface GateCustom {
  readonly label: string
  readonly hint: string
  readonly actionLabel: string
  readonly perform: (catalogUrl: string) => void
}

/**
 * What the gate is showing.
 *
 * Part of the state rather than a call on a view: whether the gate is up decides
 * whether the grid is drawn, and the two disagreed when this was imperative — the
 * gate went up and the empty-catalog line stayed underneath it.
 */
export interface GatePresentation {
  readonly title: string
  readonly body: string
  readonly action?: GateAction
  readonly link?: GateLink
  readonly choices?: readonly RegistryStoreDto[]
  readonly custom?: GateCustom
  /**
   * A way back, shown only when there is somewhere to go back *to*.
   *
   * Without it the picker was a trap: opening it with a store already installed left
   * no way to reach the grid again short of installing something.
   */
  readonly cancel?: GateAction
}
