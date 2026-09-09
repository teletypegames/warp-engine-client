import type { CredentialRepository } from '../../domain/ports/CredentialRepository'

/**
 * A client with nowhere to keep a token is a client that is never signed in.
 *
 * The two writers throw nothing away and record nothing. This is the shape a headless
 * run takes — there is no Electron in it and therefore no keychain — and a store with
 * no sign-in behaves exactly as it always did. It is an adapter like the keychain one,
 * chosen by a composition root, never a default a gateway falls back to on its own.
 */
export class NullCredentialRepository implements CredentialRepository {
  public readToken (): string | null {
    return null
  }

  public writeToken (): void {
    // Nothing to keep it in, and a headless run must not leave a credential behind.
  }

  public clearToken (): void {
    // Nothing was kept.
  }
}
