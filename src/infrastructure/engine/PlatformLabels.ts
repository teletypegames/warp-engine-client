/** What a catalog calls its platforms, by platform name. */
export class PlatformLabels {
  public constructor (private readonly labels: Readonly<Record<string, string>>) {}

  /** The display name, or the raw name for a platform the catalog did not describe. */
  public describePlatform (platform: string): string {
    const label = this.labels[platform]
    return label !== undefined && label.length > 0 ? label : platform
  }
}

/** The labels of a catalog that named none: every platform keeps its slug. */
export const NO_LABELS = new PlatformLabels({})
