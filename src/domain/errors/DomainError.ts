/**
 * The base for every error this application raises on purpose.
 *
 * `code` is what crosses the bridge: the window shows its own sentence for a code
 * it knows, and the message only ever ends up in the log drawer.
 */
export abstract class DomainError extends Error {
  public abstract readonly code: string

  protected constructor (message: string) {
    super(message)
    this.name = new.target.name
  }
}
