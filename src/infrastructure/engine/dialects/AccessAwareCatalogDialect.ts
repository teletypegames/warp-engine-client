import {
  readBoolean, readNumber, readOptionalString, readRecord, readString, type JsonRecord
} from '../../json/JsonRecord'
import type { CatalogAccess, CatalogPrice } from '../../../domain/models/CatalogAccess'
import { SoftwareListCatalogDialect } from './SoftwareListCatalogDialect'

/**
 * The catalog as WarpEngine 0.5 serves it: the same entries, plus what they cost.
 *
 * 0.5 is the first engine that can say a title is not yours. Every entry carries an
 * `access` block — even in a catalog that gates nothing, so that "this store is open"
 * and "this store did not say" stay tellable apart. Everything else about the shape is
 * unchanged, which is why this is the older dialect with one field added rather than a
 * parser of its own.
 *
 * The words are the engine's, not any store's. A client reads more than one catalog,
 * and a field named after what one shop calls its wares is a field that only works
 * there.
 */
export class AccessAwareCatalogDialect extends SoftwareListCatalogDialect {
  protected override readAccess (entry: JsonRecord): CatalogAccess | null {
    const access = readRecord(entry, 'access')
    // An entry with no block at all: possible from a 0.5 engine whose policy failed to
    // answer. Reading it as "open" would be inventing the friendlier of two answers.
    if (access === null) return null

    return {
      gated: readBoolean(access, 'gated', false),
      entitled: readNullableBoolean(access, 'entitled'),
      price: readPrice(access),
      purchaseUrl: readOptionalString(access, 'purchaseUrl'),
      webUrl: readOptionalString(access, 'webUrl')
    }
  }
}

/**
 * Three states, not two: yes, no, and nobody asked.
 *
 * A client that is not signed in gets null, and that is the case worth keeping
 * separate — it is the difference between "you do not own this" and "there is no you",
 * and only the second is a reason to offer signing in.
 */
function readNullableBoolean (record: JsonRecord, key: string): boolean | null {
  const value = record[key]
  return typeof value === 'boolean' ? value : null
}

/** A price with no currency is not a price anybody can be shown. */
function readPrice (access: JsonRecord): CatalogPrice | null {
  const price = readRecord(access, 'price')
  if (price === null) return null

  const currency = readString(price, 'currency')
  if (currency.length === 0) return null
  return { amountCents: readNumber(price, 'amountCents'), currency }
}
