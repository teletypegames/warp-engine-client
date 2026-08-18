import type { RegistryStoreDto } from './RegistryStoreDto'

/**
 * The registry lookup, failure included.
 *
 * The window has to say *why* there is nothing to install — an unreachable site
 * and an empty list need different words — so the error travels as data rather
 * than as a rejected promise.
 */
export interface RegistryResultDto {
  readonly stores: readonly RegistryStoreDto[]
  readonly sourceUrl: string
  readonly error: string | null
}
