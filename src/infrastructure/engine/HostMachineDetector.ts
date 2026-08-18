import type { HostMachine } from '../../domain/models/HostMachine'

/**
 * This machine, as the release picker needs to know it.
 *
 * Node already normalises what `uname -m` reports, but not to the names the catalog
 * uses, and the catalog's names are the ones the asset kinds are keyed by.
 */
export class HostMachineDetector {
  private cached: HostMachine | null = null

  public findHost (): HostMachine {
    this.cached ??= {
      operatingSystem: readOperatingSystem(),
      architecture: readArchitecture()
    }
    return this.cached
  }
}

/**
 * Node's names for the architectures the catalog has a name for.
 *
 * Anything not in the table passes through unchanged: it will match no asset kind,
 * and the survey then reports the titles as unavailable on this machine — which is
 * the honest answer for a host nobody has built for.
 */
const ARCHITECTURE_NAMES: Readonly<Record<string, string>> = {
  x64: 'x86_64',
  arm64: 'aarch64',
  arm: 'armhf',
  ia32: 'x86'
}

const OPERATING_SYSTEM_NAMES: Readonly<Record<string, string>> = {
  darwin: 'darwin',
  win32: 'windows',
  linux: 'linux'
}

function readArchitecture (): string {
  return ARCHITECTURE_NAMES[process.arch] ?? process.arch
}

function readOperatingSystem (): string {
  return OPERATING_SYSTEM_NAMES[process.platform] ?? process.platform
}
