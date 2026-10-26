/**
 * Which WarpEngine a catalog is served by, and whether this client knows it.
 *
 * Every WarpEngine API response carries the engine's version in a header, set before
 * the action runs so that even an error response has it. That is what lets a client
 * branch on the engine's age without a round trip to ask — and this file is where the
 * branching starts.
 */

/** `WarpEngine::VERSION_HEADER` on the server side. */
export const WARP_ENGINE_VERSION_HEADER = 'warpengine-version'

/**
 * The engine versions this client is written against, oldest first.
 *
 * Minor precision, because that is the granularity the engine changes its API at: a
 * patch release fixes something behind the same shapes. Adding an entry here is a
 * compile error until `selectCatalogDialect` says which dialect it gets, which is the
 * point — a new engine version should not be able to arrive silently.
 */
export const SUPPORTED_WARP_ENGINE_VERSIONS = [
  '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '0.10', '0.11', '0.12', '0.13',
  '0.14', '0.15', '1.0', '1.1', '1.2', '1.3', '1.4', '1.5'
] as const

export type SupportedWarpEngineVersion = typeof SUPPORTED_WARP_ENGINE_VERSIONS[number]

/**
 * Why the version this client will use is not simply the one the server named.
 *
 *   - `exact`   — the header named a version in the supported list;
 *   - `absent`  — no header at all. An engine older than 0.4.0 does not send one, so
 *                 this means "old", not "broken", and the oldest dialect is the honest
 *                 reading of it;
 *   - `older`   — a version below everything here: same treatment, but it said so;
 *   - `newer`   — a version above everything here. The newest dialect is tried anyway,
 *                 because listing nothing is worse than listing what still parses, but
 *                 this is the case worth putting in the log.
 */
export type WarpEngineVersionMatch = 'exact' | 'absent' | 'older' | 'newer'

export interface WarpEngineVersion {
  /** As the header spelled it, or null when there was none. */
  readonly text: string | null
  /** The supported version whose dialect will be used. Never null: one always applies. */
  readonly resolved: SupportedWarpEngineVersion
  readonly match: WarpEngineVersionMatch
  readonly supported: boolean
}

const OLDEST: SupportedWarpEngineVersion = SUPPORTED_WARP_ENGINE_VERSIONS[0]
const NEWEST: SupportedWarpEngineVersion =
  SUPPORTED_WARP_ENGINE_VERSIONS[SUPPORTED_WARP_ENGINE_VERSIONS.length - 1] ?? OLDEST

/**
 * Read the header into a decision.
 *
 * An unparseable value is treated as an absent one: a header that does not look like a
 * version tells us nothing about the engine, and guessing from a malformed string is
 * worse than admitting we do not know.
 */
export function readWarpEngineVersion (headerValue: string | null): WarpEngineVersion {
  if (headerValue === null || headerValue.trim().length === 0) {
    return { text: null, resolved: OLDEST, match: 'absent', supported: false }
  }
  const text = headerValue.trim()
  const numbers = parseVersion(text)
  if (numbers === null) {
    return { text, resolved: OLDEST, match: 'absent', supported: false }
  }

  const key = `${String(numbers[0])}.${String(numbers[1])}`
  const exact = SUPPORTED_WARP_ENGINE_VERSIONS
    .find((candidate: SupportedWarpEngineVersion): boolean => candidate === key)
  if (exact !== undefined) {
    return { text, resolved: exact, match: 'exact', supported: true }
  }

  const newer = compareVersions(numbers, parseVersion(NEWEST) ?? [0, 0]) > 0
  return newer
    ? { text, resolved: NEWEST, match: 'newer', supported: false }
    : { text, resolved: OLDEST, match: 'older', supported: false }
}

/** One sentence for the log, which is where an unsupported engine has to show up. */
export function describeWarpEngineVersion (version: WarpEngineVersion): string {
  const supported = SUPPORTED_WARP_ENGINE_VERSIONS.join(', ')
  switch (version.match) {
    case 'exact':
      return `WarpEngine ${version.text ?? ''}`
    case 'absent':
      return 'the catalog sent no WarpEngine-Version header — reading it as ' +
        `${OLDEST}, which is what an engine older than 0.4.0 is`
    case 'older':
      return `WarpEngine ${version.text ?? ''} is older than anything this client knows ` +
        `(${supported}) — reading it as ${OLDEST}`
    case 'newer':
      return `WarpEngine ${version.text ?? ''} is newer than this client knows ` +
        `(${supported}) — reading it as ${NEWEST}, so some titles may be missed`
  }
}

function parseVersion (text: string): readonly [number, number] | null {
  const match = /(\d+)\.(\d+)/.exec(text)
  if (match === null) return null
  return [Number(match[1]), Number(match[2])]
}

function compareVersions (left: readonly [number, number], right: readonly [number, number]): number {
  if (left[0] !== right[0]) return left[0] - right[0]
  return left[1] - right[1]
}
