import os from 'node:os'
import path from 'node:path'

/**
 * True when `target` is `root` or sits inside it.
 *
 * Every delete a store performs is guarded by this.
 */
export function isWithin (target: string, root: string): boolean {
  if (target.length === 0 || root.length === 0) return false
  const resolvedTarget = path.resolve(target)
  const resolvedRoot = path.resolve(root)
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep)
}

/** `$XDG_DATA_HOME|~/.local/share/applications` or a plain `~`-path, resolved. */
export function expandPathSpecification (specification: string | null): string | null {
  if (specification === null || specification.length === 0) return null
  let remaining = specification
  if (remaining.startsWith('$')) {
    const [variable, fallback] = splitOnce(remaining.slice(1), '|')
    // `$XDG_DATA_HOME|~/.local/share/applications` — the tail after the fallback's
    // own prefix is what gets appended to the variable.
    const [name, tail] = splitOnce(variable, '/')
    const value = process.env[name]
    if (value !== undefined && value.length > 0) {
      const base = expandHome(value)
      return path.resolve(tail.length > 0 ? path.join(base, tail) : base)
    }
    remaining = fallback
  }
  if (remaining.length === 0) return null
  return path.resolve(expandVariables(expandHome(remaining)))
}

export function expandHome (value: string): string {
  return value === '~' || value.startsWith(`~${path.sep}`) || value.startsWith('~/')
    ? path.join(os.homedir(), value.slice(2))
    : value
}

function expandVariables (value: string): string {
  return value.replace(/\$(\w+)|\$\{(\w+)\}/g, (match: string, bare: string | undefined, braced: string | undefined): string =>
    process.env[bare ?? braced ?? ''] ?? match)
}

function splitOnce (value: string, separator: string): readonly [string, string] {
  const index = value.indexOf(separator)
  return index < 0 ? [value, ''] : [value.slice(0, index), value.slice(index + separator.length)]
}
