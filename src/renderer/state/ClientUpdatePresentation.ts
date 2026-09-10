import type { ClientUpdateDto } from '../../shared/contracts/dto/ClientUpdateDto'

/**
 * Where the update check stands, as the side menu shows it.
 *
 * State rather than calls on the view, like the gate: the link, the sentence under it
 * and the download button are all decided by this one value, so they cannot disagree.
 * Null is "not asked yet", which is how the window starts and stays until someone clicks.
 */
export type ClientUpdatePresentation =
  | { readonly phase: 'checking' }
  | { readonly phase: 'checked'; readonly result: ClientUpdateDto }
  | { readonly phase: 'failed' }
