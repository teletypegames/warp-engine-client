/**
 * What one catalog's server says about itself.
 *
 * This is how the client stops being built for a particular store. Whether there is a
 * sign-in here, where it lives, whether any title can be gated — all of it used to be
 * knowledge the client would have had to carry, and a client that carries it works for
 * exactly one catalog. Now the server answers, and the same binary serves any of them.
 *
 * Every field is optional in practice: an engine older than 0.5 has no descriptor at
 * all, and `DEFAULT_SERVICE_DESCRIPTOR` is what that means — a plain catalog, nothing
 * gated, nobody to sign in as. That is what this client always assumed.
 */
export interface ServiceDescriptor {
  readonly engineVersion: string | null
  /** Whether any title in this catalog can require an entitlement. */
  readonly catalogGated: boolean
  /** Null where the server offers no sign-in, which is most of them. */
  readonly auth: AuthDescriptor | null
}

export interface AuthDescriptor {
  /** The device authorization grant, for a client with no browser of its own. */
  readonly device: DeviceAuthDescriptor
}

export interface DeviceAuthDescriptor {
  /** Where to ask for a code pair. */
  readonly authorizeUrl: string
  /** Where to poll for the token. */
  readonly tokenUrl: string
  /** Where to throw the token away again. */
  readonly revokeUrl: string | null
  /** Where a person takes the code, opened in their own browser. */
  readonly verificationUrl: string
  /** Seconds the server asks the client to wait between polls. */
  readonly interval: number
}

export const DEFAULT_SERVICE_DESCRIPTOR: ServiceDescriptor = {
  engineVersion: null,
  catalogGated: false,
  auth: null
}
