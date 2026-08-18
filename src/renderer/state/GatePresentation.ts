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
}
