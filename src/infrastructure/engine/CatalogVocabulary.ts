/**
 * What the catalog calls its categories, and which of its statuses a store lists.
 *
 * Read from `GET /api/software/vocabulary` (WarpEngine 0.13); an engine without the
 * endpoint leaves every key as its own label, which is what the cards showed before.
 * The statuses' labels are not needed — the client's status axis is about this machine
 * (installed, updates), not about the catalog's words — but their `defaultVisible` is:
 * a store whose config names no statuses lists the ones the catalog marks visible.
 */
export class CatalogVocabulary {
  public constructor (
    private readonly categories: Readonly<Record<string, string>>,
    private readonly visibleStatuses: readonly string[] | null = null
  ) {}

  public describeCategory (key: string): string {
    const label = this.categories[key]
    return label !== undefined && label.length > 0 ? label : key
  }

  /**
   * The statuses to list: the config's own choice if it made one, else the catalog's,
   * else released and archived — what the engine listed before catalogs could say.
   */
  public resolveStatuses (configured: readonly string[] | null): readonly string[] {
    return configured ?? this.visibleStatuses ?? FALLBACK_STATUSES
  }
}

export const FALLBACK_STATUSES: readonly string[] = ['released', 'archived']

export const NO_VOCABULARY = new CatalogVocabulary({})
