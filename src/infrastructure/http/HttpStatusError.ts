/** A response that arrived but said no. The status matters: 404 is not a failure everywhere. */
export class HttpStatusError extends Error {
  public constructor (public readonly url: string, public readonly statusCode: number) {
    super(`${url} answered ${String(statusCode)}`)
    this.name = 'HttpStatusError'
  }
}
