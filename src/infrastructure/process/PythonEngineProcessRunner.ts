import { spawn, spawnSync } from 'node:child_process'
import { EngineInvocationError } from '../../domain/errors/EngineInvocationError'
import { PythonMissingError } from '../../domain/errors/PythonMissingError'
import type { EngineProgressListener } from '../../domain/models/EngineProgress'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import type { PythonRuntimeLocator } from '../../domain/ports/PythonRuntimeLocator'
import type { SyncEventDto } from '../../shared/contracts/dto/SyncEventDto'
import { asRecord, type JsonRecord } from '../json/JsonRecord'

const VERSION_PROBE_TIMEOUT_MS = 15_000

/**
 * Runs one engine command and reads its two streams.
 *
 * The engine's contract with any client is `--json`: data on stdout, one JSON
 * object per line, and the human-readable log on stderr. So nothing here parses a
 * sentence meant for a person, and a line that is not JSON is handed to the log
 * rather than crashing the call.
 */
export class PythonEngineProcessRunner {
  public constructor (private readonly runtimeLocator: PythonRuntimeLocator) {}

  public async runCommand (
    store: InstalledStore,
    commandArguments: readonly string[],
    progress: EngineProgressListener = {}
  ): Promise<readonly JsonRecord[]> {
    const runtime = this.runtimeLocator.findRuntime()
    if (runtime === null) throw new PythonMissingError()

    const argv = [
      ...runtime.arguments,
      store.scriptPath,
      '--config', store.configPath,
      '--json',
      ...commandArguments
    ]

    return new Promise<readonly JsonRecord[]>((
      resolve: (records: readonly JsonRecord[]) => void,
      reject: (error: Error) => void
    ): void => {
      const child = spawn(runtime.command, argv, {
        env: { ...process.env, DESKTOP_STORE_HOME: store.home }
      })
      const records: JsonRecord[] = []
      let stdoutRest = ''
      let stderrRest = ''

      const takeStdout = (chunk: string): void => {
        stdoutRest += chunk
        const parts = stdoutRest.split('\n')
        stdoutRest = parts.pop() ?? ''
        for (const part of parts) this.consumeStdoutLine(part, records, progress)
      }

      const takeStderr = (chunk: string): void => {
        stderrRest += chunk
        const parts = stderrRest.split('\n')
        stderrRest = parts.pop() ?? ''
        for (const part of parts) {
          if (part.trim().length > 0) progress.onLog?.(part)
        }
      }

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', takeStdout)
      child.stderr.on('data', takeStderr)
      child.on('error', (error: Error): void => {
        reject(new EngineInvocationError(error.message))
      })
      child.on('close', (code: number | null): void => {
        takeStdout('\n')
        takeStderr('\n')
        if (code === 0) resolve(records)
        else reject(new EngineInvocationError(`the store exited with code ${String(code)}`, code))
      })
    })
  }

  /** The engine's `--version`, read synchronously because it gates the first paint. */
  public readVersionText (store: InstalledStore): string | null {
    const runtime = this.runtimeLocator.findRuntime()
    if (runtime === null) return null
    try {
      const probe = spawnSync(runtime.command, [...runtime.arguments, store.scriptPath, '--version'], {
        encoding: 'utf8',
        timeout: VERSION_PROBE_TIMEOUT_MS
      })
      const text = `${probe.stdout}${probe.stderr}`.trim()
      return probe.status === 0 && text.length > 0 ? text : null
    } catch {
      return null
    }
  }

  private consumeStdoutLine (
    line: string,
    records: JsonRecord[],
    progress: EngineProgressListener
  ): void {
    if (line.trim().length === 0) return
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      // Not ours to interpret — hand it on as a log line rather than fail the call.
      progress.onLog?.(line)
      return
    }
    const record = asRecord(parsed)
    if (record === null) return
    records.push(record)
    const event = this.asSyncEvent(record)
    if (event !== null) progress.onEvent?.(event)
  }

  /**
   * A progress line, or null for the final result object.
   *
   * The engine tags its stream events with `event`; the listing and paths answers
   * carry no such field, which is exactly the difference.
   */
  private asSyncEvent (record: JsonRecord): SyncEventDto | null {
    return typeof record['event'] === 'string' ? (record as unknown as SyncEventDto) : null
  }
}
