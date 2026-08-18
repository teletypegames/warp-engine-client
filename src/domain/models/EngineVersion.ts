/**
 * The engine version this client found, and whether it can drive it.
 *
 * `--json` arrived with engine 1.1.0. An older engine is not broken, it simply
 * cannot be driven from a window — and it will be met in the wild, because the CLI
 * shipped before this client did.
 */
export interface EngineVersion {
  readonly text: string
  readonly numbers: readonly number[] | null
  readonly supported: boolean
}

export const MINIMUM_ENGINE_VERSION: readonly number[] = [1, 1, 0]

export function parseVersionNumbers (text: string): readonly number[] | null {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(text)
  return match ? match.slice(1, 4).map((part: string): number => Number(part)) : null
}

export function isAtLeast (version: readonly number[] | null, minimum: readonly number[]): boolean {
  if (version === null) return false
  for (let index = 0; index < minimum.length; index += 1) {
    const found = version[index] ?? 0
    const needed = minimum[index] ?? 0
    if (found > needed) return true
    if (found < needed) return false
  }
  return true
}

export function formatVersion (numbers: readonly number[]): string {
  return numbers.join('.')
}
