import type { DeviceAuthDescriptor } from '../../domain/models/ServiceDescriptor'
import type { StoreHttpClient } from '../http/StoreHttpClient'
import { asRecord, readNumber, readOptionalString, readString } from '../json/JsonRecord'

/** What the server said when asked for a code pair. */
export interface DeviceCodeRequest {
  readonly deviceCode: string
  /** Short enough to read off this screen and type into a browser. */
  readonly userCode: string
  readonly verificationUrl: string
  readonly intervalSeconds: number
  readonly expiresInSeconds: number
}

export type DeviceSignInState = 'pending' | 'approved' | 'denied' | 'expired'

export interface DevicePollResult {
  readonly state: DeviceSignInState
  /** Present exactly once: on the poll that finds the grant newly approved. */
  readonly token: string | null
}

/**
 * The device authorization grant, client side.
 *
 * The client has no browser of its own, so it cannot host a login form without asking
 * somebody to type a password into a window that is not one. Instead it asks for a pair
 * of codes, shows the short one, sends the person to the server's own page, and polls
 * with the long one until it is answered.
 *
 * Every address comes from the service descriptor rather than from here. That is the
 * point: this class knows the *shape* of the flow, which is the engine's, and nothing
 * about any particular store's addresses.
 */
export class DeviceSignInClient {
  public constructor (
    private readonly http: StoreHttpClient,
    private readonly device: DeviceAuthDescriptor
  ) {}

  public async requestCode (clientName: string): Promise<DeviceCodeRequest> {
    const { json } = await this.http.requestJson(this.device.authorizeUrl, {
      method: 'POST',
      payload: { client_name: clientName }
    })
    const record = asRecord(json)
    if (record === null) throw new Error('the server did not answer with a device code')

    const deviceCode = readOptionalString(record, 'deviceCode')
    const userCode = readOptionalString(record, 'userCode')
    if (deviceCode === null || userCode === null) {
      throw new Error('the server did not answer with a device code')
    }

    return {
      deviceCode,
      userCode,
      verificationUrl: readOptionalString(record, 'verificationUrl') ?? this.device.verificationUrl,
      // The server's own pacing wins over the descriptor's: it knows what it can take.
      intervalSeconds: Math.max(1, readNumber(record, 'interval', this.device.interval)),
      expiresInSeconds: Math.max(1, readNumber(record, 'expiresIn', 600))
    }
  }

  public async poll (deviceCode: string): Promise<DevicePollResult> {
    // 404 is a real answer here — the grant was swept or never existed — so it is read
    // rather than thrown, and reported as expired: from the client's side those are the
    // same situation, and both mean start again.
    const { json, statusCode } = await this.http.requestJson(this.device.tokenUrl, {
      method: 'POST',
      payload: { device_code: deviceCode },
      accept: [ 404, 410 ]
    })
    if (statusCode !== 200) return { state: 'expired', token: null }

    const record = asRecord(json)
    if (record === null) return { state: 'pending', token: null }

    return {
      state: toState(readString(record, 'state')),
      token: readOptionalString(record, 'token')
    }
  }

  /**
   * Signing out: the token this client carries is revoked at the server.
   *
   * There is no token argument because there is nowhere to put one — the credential
   * rides on the request as a bearer header, from the same supplier every other call
   * uses. Best effort on purpose: the token is thrown away locally either way, and a
   * server that cannot be reached must not leave somebody stuck signed in.
   */
  public async revoke (): Promise<boolean> {
    if (this.device.revokeUrl === null) return false

    try {
      const { statusCode } = await this.http.requestJson(this.device.revokeUrl, {
        method: 'DELETE',
        accept: [ 204, 401 ]
      })
      return statusCode === 204
    } catch {
      return false
    }
  }
}

function toState (value: string): DeviceSignInState {
  switch (value) {
    case 'approved':
    case 'denied':
    case 'expired':
      return value
    default:
      return 'pending'
  }
}
