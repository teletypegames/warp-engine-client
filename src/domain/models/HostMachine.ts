/**
 * The machine the store is running on, and how a config value depends on it.
 *
 * A native binary only starts on the architecture it was built for, so the release
 * picker has to know: an x86_64 build installs on a Raspberry Pi and then does
 * nothing, which is worse than not offering it at all.
 */
export interface HostMachine {
  readonly operatingSystem: string
  readonly architecture: string
}

/**
 * A config value that may differ per machine.
 *
 * A plain value is the same everywhere — that is how a `cartridge` is described,
 * being data for an emulator. Where it differs, the value is a map keyed by host.
 */
export type HostSpecific<TValue> = TValue | Readonly<Record<string, TValue>>

/**
 * Resolve a host-specific value; the most specific key wins.
 *
 *     {"linux-aarch64": …, "aarch64": …, "linux": …, "*": …}
 *
 * With no matching key and no `*` the answer is `null`, and the caller reports the
 * title as unavailable rather than installing something that cannot run.
 */
export function resolveForHost<TValue> (
  value: HostSpecific<TValue> | null | undefined,
  host: HostMachine
): TValue | null {
  if (value === null || value === undefined) return null
  if (!isHostMap(value)) return value
  for (const key of hostKeys(host)) {
    const found = value[key]
    if (found !== undefined) return found
  }
  return null
}

export function hostKeys (host: HostMachine): readonly string[] {
  return [
    `${host.operatingSystem}-${host.architecture}`,
    host.architecture,
    host.operatingSystem,
    '*'
  ]
}

export function describeHost (host: HostMachine): string {
  return `${host.operatingSystem}/${host.architecture}`
}

/**
 * A host map, as opposed to a value that happens to be an object.
 *
 * Only plain objects are maps: an array is a value here — `kind` may be a list of
 * asset kinds in order of preference, and that is not keyed by anything.
 */
function isHostMap<TValue> (
  value: HostSpecific<TValue>
): value is Readonly<Record<string, TValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
