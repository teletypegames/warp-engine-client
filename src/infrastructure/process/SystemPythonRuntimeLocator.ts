import { spawnSync } from 'node:child_process'
import type { PythonRuntime } from '../../domain/models/PythonRuntime'
import type { PythonRuntimeLocator } from '../../domain/ports/PythonRuntimeLocator'

interface RuntimeCandidate {
  readonly command: string
  readonly arguments: readonly string[]
}

/** `py -3` is the Windows launcher, and often the only Python on PATH there. */
const WINDOWS_CANDIDATES: readonly RuntimeCandidate[] = [
  { command: 'py', arguments: ['-3'] },
  { command: 'python', arguments: [] },
  { command: 'python3', arguments: [] }
]

const POSIX_CANDIDATES: readonly RuntimeCandidate[] = [
  { command: 'python3', arguments: [] },
  { command: 'python', arguments: [] }
]

const PROBE_TIMEOUT_MS = 10_000

/**
 * Finds the Python 3 the store needs.
 *
 * The answer is cached: the probe spawns processes, and the window asks for it on
 * every state read.
 */
export class SystemPythonRuntimeLocator implements PythonRuntimeLocator {
  private cached: PythonRuntime | null = null
  private probed = false

  public findRuntime (): PythonRuntime | null {
    if (this.probed) return this.cached
    this.probed = true
    const candidates = process.platform === 'win32' ? WINDOWS_CANDIDATES : POSIX_CANDIDATES
    for (const candidate of candidates) {
      const runtime = this.probeCandidate(candidate)
      if (runtime !== null) {
        this.cached = runtime
        return runtime
      }
    }
    return null
  }

  private probeCandidate (candidate: RuntimeCandidate): PythonRuntime | null {
    try {
      const probe = spawnSync(candidate.command, [...candidate.arguments, '--version'], {
        encoding: 'utf8',
        timeout: PROBE_TIMEOUT_MS
      })
      const output = `${probe.stdout}${probe.stderr}`
      if (probe.status === 0 && output.includes('Python 3.')) {
        return { command: candidate.command, arguments: candidate.arguments, version: output.trim() }
      }
    } catch {
      // An absent interpreter is the normal case, not an error worth reporting.
    }
    return null
  }
}
