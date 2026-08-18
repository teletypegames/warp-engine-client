/** The Python 3 this machine has, and how to invoke it. */
export interface PythonRuntime {
  readonly command: string
  readonly arguments: readonly string[]
  readonly version: string
}
