import { asRecord, readString } from '../../infrastructure/json/JsonRecord'
import type { RegistryStoreDto } from '../../shared/contracts/dto/RegistryStoreDto'

/**
 * Reading what came over the bridge.
 *
 * The window is ours, but the channel is an interface: a payload is checked here
 * once, so no service below has to wonder whether a string is really a string.
 */
export function requireString (value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`)
  }
  return value
}

export function requireBoolean (value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be a boolean`)
  return value
}

export function requireStringArray (value: unknown, name: string): readonly string[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array of strings`)
  return value.map((item: unknown, index: number): string => requireString(item, `${name}[${String(index)}]`))
}

export function requireRegistryStore (value: unknown): RegistryStoreDto {
  const record = asRecord(value)
  if (record === null) throw new TypeError('a store record is required')
  const store: RegistryStoreDto = {
    name: readString(record, 'name'),
    catalogUrl: readString(record, 'catalogUrl'),
    storeId: readString(record, 'storeId')
  }
  if (store.name.length === 0 || store.catalogUrl.length === 0) {
    throw new TypeError('a store record needs a name and a catalog URL')
  }
  return store
}
