// The two bundles and the two static files.
//
// tsc compiles the main process, where CommonJS and `require` are fine. The preload
// and the renderer cannot work that way: a sandboxed preload may not require its own
// modules, and a module script over file:// is blocked by the page's own origin
// rules. So both are bundled into one file each — the layering stays in src/, the
// window gets a single script.
import { build } from 'esbuild'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outDir = join(root, 'build')

const bundles = [
  {
    label: 'preload',
    entryPoints: [join(root, 'src/preload/preload.ts')],
    outfile: join(outDir, 'preload/preload.js'),
    platform: 'node',
    format: 'cjs',
    // Provided by Electron at runtime; bundling it would break the sandbox.
    external: ['electron']
  },
  {
    label: 'renderer',
    entryPoints: [join(root, 'src/renderer/main.ts')],
    outfile: join(outDir, 'renderer/app.js'),
    platform: 'browser',
    format: 'iife',
    external: []
  }
]

for (const bundle of bundles) {
  await build({
    entryPoints: bundle.entryPoints,
    outfile: bundle.outfile,
    bundle: true,
    platform: bundle.platform,
    format: bundle.format,
    external: bundle.external,
    target: 'es2023',
    logLevel: 'warning'
  })
  console.log(`bundled ${bundle.label} -> ${bundle.outfile.replace(`${root}/`, '')}`)
}

await mkdir(join(outDir, 'renderer'), { recursive: true })
for (const asset of ['index.html', 'style.css']) {
  await copyFile(join(root, 'src/renderer', asset), join(outDir, 'renderer', asset))
  console.log(`copied ${asset}`)
}
