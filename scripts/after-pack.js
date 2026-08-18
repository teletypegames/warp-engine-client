'use strict'
// Ad-hoc sign the macOS bundle after packing.
//
// Without this the bundle carries only the linker's ad-hoc signature on the main
// executable, with no resource seal — `codesign --verify` says "code has no
// resources but signature indicates they must be present". That runs fine
// locally, but a browser download adds the quarantine flag, Gatekeeper evaluates
// the broken seal, and macOS reports the app as *damaged* rather than merely
// unverified. The first release shipped exactly that.
//
// An ad-hoc signature is not a Developer ID and does not notarise anything: the
// user still has to right-click ▸ Open the first time. It is the difference
// between "unidentified developer" and "move it to the Bin".

const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterPack (context) {
  if (context.electronPlatformName !== 'darwin') return
  if (process.platform !== 'darwin') {
    console.log('  • ad-hoc signing skipped  reason=codesign only exists on macOS')
    return
  }

  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  // --deep is the pragmatic choice for ad-hoc signing a bundle with nested
  // frameworks and helpers; Apple discourages it for real identities, where the
  // inner-to-outer order matters.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=1', app], { stdio: 'inherit' })
  console.log(`  • ad-hoc signed   ${app}`)
}
