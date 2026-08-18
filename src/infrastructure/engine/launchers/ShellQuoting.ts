/**
 * Quoting for the two shells a desktop launcher goes through.
 *
 * A game title is user data that ends up inside an `Exec=` line and a `/bin/sh`
 * script, and titles contain apostrophes. These are the same rules Python's
 * `shlex.quote` and a PowerShell single-quoted string follow.
 */

const SAFE_UNQUOTED = /^[A-Za-z0-9_@%+=:,./-]+$/

export function quoteForShell (value: string): string {
  if (value.length === 0) return "''"
  if (SAFE_UNQUOTED.test(value)) return value
  return `'${value.replace(/'/g, "'\"'\"'")}'`
}

export function quoteForPowerShell (value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export function escapeForXml (value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
