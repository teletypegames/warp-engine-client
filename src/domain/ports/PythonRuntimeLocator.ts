import type { PythonRuntime } from '../models/PythonRuntime'

export interface PythonRuntimeLocator {
  findRuntime: () => PythonRuntime | null
}
