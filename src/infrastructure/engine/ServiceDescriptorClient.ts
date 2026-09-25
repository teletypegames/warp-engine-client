import {
  DEFAULT_SERVICE_DESCRIPTOR, type AuthDescriptor, type DeviceAuthDescriptor,
  type ServiceDescriptor
} from '../../domain/models/ServiceDescriptor'
import { HttpStatusError } from '../http/HttpStatusError'
import type { StoreHttpClient } from '../http/StoreHttpClient'
import { asRecord, readBoolean, readNumber, readOptionalString, readRecord } from '../json/JsonRecord'

const SERVICE_PATH = '/api/service'

/**
 * `GET /api/service`: what this catalog's server is, asked before anything else.
 *
 * A missing descriptor is an answer, not a failure. Every WarpEngine before 0.5 has no
 * such endpoint, so a 404 means "an older engine" — a plain catalog with nothing gated
 * and nobody to sign in as, which is exactly what this client assumed for its whole
 * life before now. Same for a network that is simply down: the store still works
 * offline from its cached catalog, and refusing to open because we could not ask the
 * server about itself would be a worse client than the one we had.
 */
export class ServiceDescriptorClient {
  public constructor (
    private readonly http: StoreHttpClient,
    private readonly baseUrl: string,
    private readonly log: (line: string) => void
  ) {}

  public async fetchDescriptor (): Promise<ServiceDescriptor> {
    const url = `${this.baseUrl}${SERVICE_PATH}`
    try {
      const { json } = await this.http.requestJson(url)
      const record = asRecord(json)
      if (record === null) return DEFAULT_SERVICE_DESCRIPTOR

      const descriptor: ServiceDescriptor = {
        engineVersion: readOptionalString(record, 'version'),
        catalogGated: readBoolean(readRecord(record, 'catalog') ?? {}, 'gated', false),
        auth: readAuth(record, this.baseUrl),
        adminApiVersion: readAdminApiVersion(record)
      }
      this.log(describe(descriptor))
      return descriptor
    } catch (error: unknown) {
      if (error instanceof HttpStatusError && error.statusCode === 404) {
        this.log('the catalog has no service descriptor — an engine older than 0.5')
      } else {
        this.log(`warning: could not read ${url} — carrying on as a plain catalog`)
      }
      return DEFAULT_SERVICE_DESCRIPTOR
    }
  }
}

function readAuth (record: Readonly<Record<string, unknown>>, baseUrl: string): AuthDescriptor | null {
  const auth = readRecord(record, 'auth')
  if (auth === null) return null

  const device = readRecord(auth, 'device')
  if (device === null) return null

  const authorizeUrl = absolute(readOptionalString(device, 'authorizeUrl'), baseUrl)
  const tokenUrl = absolute(readOptionalString(device, 'tokenUrl'), baseUrl)
  const verificationUrl = absolute(readOptionalString(device, 'verificationUrl'), baseUrl)
  // Two of the three are the flow itself and the third is where a person goes. Without
  // all three there is no sign-in to offer, and half a flow is worse than none.
  if (authorizeUrl === null || tokenUrl === null || verificationUrl === null) return null

  const descriptor: DeviceAuthDescriptor = {
    authorizeUrl,
    tokenUrl,
    revokeUrl: absolute(readOptionalString(device, 'revokeUrl'), baseUrl),
    verificationUrl,
    interval: Math.max(1, readNumber(device, 'interval', 5))
  }
  return { device: descriptor }
}

function readAdminApiVersion (record: Readonly<Record<string, unknown>>): number | null {
  const admin = readRecord(record, 'admin')
  if (admin === null) return null
  const version = readNumber(admin, 'version', 0)
  return version > 0 ? version : null
}

/** A server may answer with a path; it knows its own address better than we do. */
function absolute (value: string | null, baseUrl: string): string | null {
  if (value === null || value.length === 0) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  return `${baseUrl.replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`
}

function describe (descriptor: ServiceDescriptor): string {
  const version = descriptor.engineVersion ?? 'an unnamed version'
  const gated = descriptor.catalogGated ? 'some titles need an entitlement' : 'nothing is gated'
  const auth = descriptor.auth === null ? 'no sign-in' : 'sign-in available'
  const admin = descriptor.adminApiVersion === null ? '' : `, Admin API v${String(descriptor.adminApiVersion)} alongside`
  return `catalog served by WarpEngine ${version} — ${gated}, ${auth}${admin}`
}
