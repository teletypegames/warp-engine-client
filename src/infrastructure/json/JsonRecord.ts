/**
 * Reading JSON that came from somewhere else.
 *
 * The engine's stdout and the site's registry are both outside this program, so
 * their shape is a claim, not a fact. These readers turn `unknown` into typed
 * values with a stated fallback, which keeps every parser honest and every mapper
 * free of casts.
 */
export type JsonRecord = Readonly<Record<string, unknown>>

export function asRecord (value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

export function readString (record: JsonRecord, key: string, fallback: string = ''): string {
  const value = record[key]
  return typeof value === 'string' ? value : fallback
}

export function readOptionalString (record: JsonRecord, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function readBoolean (record: JsonRecord, key: string, fallback: boolean = false): boolean {
  const value = record[key]
  return typeof value === 'boolean' ? value : fallback
}

export function readNumber (record: JsonRecord, key: string, fallback: number = 0): number {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function readStringArray (record: JsonRecord, key: string): readonly string[] {
  const value = record[key]
  if (!Array.isArray(value)) return []
  return value.filter((item: unknown): item is string => typeof item === 'string')
}

export function readRecordArray (record: JsonRecord, key: string): readonly JsonRecord[] {
  const value = record[key]
  if (!Array.isArray(value)) return []
  return value
    .map((item: unknown): JsonRecord | null => asRecord(item))
    .filter((item: JsonRecord | null): item is JsonRecord => item !== null)
}

export function readRecord (record: JsonRecord, key: string): JsonRecord | null {
  return asRecord(record[key])
}
