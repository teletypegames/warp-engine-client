/**
 * An error as a sentence for a log line or a report.
 *
 * Anything can be thrown, so anything can arrive in a `catch`: an `Error` gives up its
 * message, and everything else is printed as it is. This is the one place that rule is
 * written down; every log line that quotes an error goes through it.
 */
export function describeError (error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
