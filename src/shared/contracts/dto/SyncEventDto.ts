/**
 * One line of the engine's progress stream.
 *
 * The engine emits JSONL on stdout; these are the events the window reacts to.
 * `plan` gives the count, `begin`/`installed` drive the counter, and the rest end
 * up in the log drawer.
 */
export type SyncEventDto =
  | { readonly event: 'plan'; readonly count: number }
  | { readonly event: 'begin'; readonly name: string; readonly title: string }
  | { readonly event: 'installed'; readonly name: string; readonly title: string; readonly changed: boolean }
  | { readonly event: 'failed'; readonly name: string; readonly error: string }
  | { readonly event: 'removed'; readonly name: string }
  | { readonly event: 'pruned'; readonly name: string }
  | { readonly event: 'finished'; readonly installed: number; readonly failed: number }
