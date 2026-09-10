/** One published release of this client, as the release feed names it. */
export interface ClientRelease {
  /** The tag with its `v` stripped, so it compares with `package.json`'s version. */
  readonly version: string
  /** The release page: where the packages are, for a person to pick theirs. */
  readonly url: string
}

/** What a check found: the version running, the version published, and whether they differ that way round. */
export interface ClientUpdateCheck {
  readonly currentVersion: string
  readonly latestVersion: string
  readonly releaseUrl: string
  readonly updateAvailable: boolean
}

/**
 * Compare two dotted version numbers, numerically and part by part.
 *
 * A missing part counts as zero, so `2.9` and `2.9.0` are the same version, and anything
 * that is not a number is read as zero rather than refused: the feed is ours, and a tag
 * that does not look like a version is a mistake to show, not to crash on.
 */
export function compareVersionNumbers (left: string, right: string): number {
  const a = parseVersionNumbers(left)
  const b = parseVersionNumbers(right)
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function checkForUpdate (currentVersion: string, latest: ClientRelease): ClientUpdateCheck {
  return {
    currentVersion,
    latestVersion: latest.version,
    releaseUrl: latest.url,
    updateAvailable: compareVersionNumbers(latest.version, currentVersion) > 0
  }
}

function parseVersionNumbers (text: string): readonly number[] {
  return text.trim().replace(/^v/i, '').split('.').map((part: string): number => {
    const number = Number.parseInt(part, 10)
    return Number.isFinite(number) ? number : 0
  })
}
