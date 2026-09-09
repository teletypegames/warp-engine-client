import { describeError } from '../domain/errors/DescribeError'
import { RendererApplication } from './RendererApplication'

// The renderer's entry point. Errors here would otherwise be invisible: the main
// process log stays empty when the page throws, so the window says it out loud.
void new RendererApplication().start().catch((error: unknown): void => {
  console.error(describeError(error))
})
