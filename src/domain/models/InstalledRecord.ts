import type { SelectedGame } from './SelectedGame'

/**
 * One title as it exists on this machine: what was written, and where.
 *
 * This is the shape `state.json` carries, keyed `<scope>:<name>`. Every path in it
 * is something the store put there and may therefore delete — which is why an
 * uninstall reads the record rather than guessing at paths.
 *
 * The catalog's `access` block is deliberately *not* part of it. Whether somebody may
 * download a title is the server's answer to a question asked now; a copy of it on disk
 * would go stale the moment a purchase or a refund happened, and a stale "yes" is the
 * dangerous direction. What is installed stays installed either way.
 *
 * Nor is `category`: it is the catalog's word for the title and is read from the
 * catalog each time, so the file keeps the shape the other store clients write.
 */
export interface InstalledRecord extends Omit<SelectedGame, 'access' | 'category'> {
  /** The unpacked archive's directory; null for a hosted entry, which has none. */
  readonly payload: string | null
  readonly executable: string | null
  /** `bundle` for a macOS `.app` the archive already contained, `exe` for a binary. */
  readonly executableKind: string | null
  readonly icon: string | null
  /** The menu entry actually written, which is not always the one intended. */
  readonly menuEntry: string | null
  readonly url: string | null
}

/**
 * The scope a state record belongs to.
 *
 * `scope` is what the engine writes today. `system` is what the Batocera store
 * wrote before the shared core existed, and there the two were the same string —
 * so an installed machine keeps working without a migration.
 */
export function recordScope (scope: string | null, system: string | null): string {
  return scope ?? system ?? ''
}

/** Two scopes may both carry a game called `foo` — key on both. */
export function gameKey (record: { readonly name: string; readonly scope: string }): string {
  return `${record.scope}:${record.name}`
}

/** Resolve user-typed `name` or `scope:name` arguments to state keys. */
export function matchStateKeys (
  installed: ReadonlyMap<string, InstalledRecord>,
  names: readonly string[]
): readonly string[] {
  const wanted = new Set(names.map((name: string): string => name.toLowerCase()))
  const keys: string[] = []
  for (const [key, record] of installed) {
    if (wanted.has(key.toLowerCase()) || wanted.has(record.name.toLowerCase())) keys.push(key)
  }
  return keys
}

/** Keep only the games the user named, by bare name or `scope:name`. */
export function limitToNames (
  games: readonly SelectedGame[],
  names: readonly string[]
): readonly SelectedGame[] {
  const wanted = new Set(names.map((name: string): string => name.toLowerCase()))
  return games.filter((game: SelectedGame): boolean =>
    wanted.has(game.name.toLowerCase()) || wanted.has(gameKey(game).toLowerCase()))
}
