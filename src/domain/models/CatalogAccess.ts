/**
 * What a catalog says about getting one title.
 *
 * The vocabulary is the engine's and deliberately generic — `gated`, `entitled`, a
 * price. One client reads many catalogs, so a field named after what a particular shop
 * calls the thing it sells is a field that works in exactly one shop.
 *
 * Absent (`null` where this appears) is its own answer: an engine too old to have an
 * opinion. That is not the same as "not gated", and only one of the two is a reason to
 * offer somebody a sign-in.
 */
export interface CatalogAccess {
  /** Downloading needs an entitlement. */
  readonly gated: boolean
  /** For the signed-in caller; null when nobody was signed in to ask about. */
  readonly entitled: boolean | null
  readonly price: CatalogPrice | null
  /** Where a person goes to get it. Absolute — it opens in their own browser. */
  readonly purchaseUrl: string | null
  /** Where a hosted build is played, when the catalog serves it somewhere of its own. */
  readonly webUrl: string | null
}

export interface CatalogPrice {
  readonly amountCents: number
  readonly currency: string
}

/**
 * Can this caller install this title?
 *
 * Three answers, because the middle one is real: yes; no, and here is where to buy it;
 * and "the catalog would tell you if you signed in". A client that collapsed the last
 * two would either hide a title somebody owns or offer to sell them one they have.
 */
export type AccessVerdict = 'open' | 'entitled' | 'purchasable' | 'signInRequired'

export function readAccessVerdict (access: CatalogAccess | null): AccessVerdict {
  if (access?.gated !== true) return 'open'
  if (access.entitled === true) return 'entitled'
  return access.entitled === false ? 'purchasable' : 'signInRequired'
}
