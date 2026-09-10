/**
 * What the catalog calls its categories.
 *
 * Read from `GET /api/software/vocabulary` (WarpEngine 0.13); an engine without the
 * endpoint leaves every key as its own label, which is what the cards showed before.
 * Statuses live in the same vocabulary but are not needed here: the client's status axis
 * is about this machine (installed, updates), not about the catalog's words.
 */
export class CatalogVocabulary {
  public constructor (private readonly categories: Readonly<Record<string, string>>) {}

  public describeCategory (key: string): string {
    const label = this.categories[key]
    return label !== undefined && label.length > 0 ? label : key
  }
}

export const NO_VOCABULARY = new CatalogVocabulary({})
