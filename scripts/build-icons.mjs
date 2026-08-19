#!/usr/bin/env node
// Render every icon format from resources/icon.svg.
//
// The point of this script is that the icon stays *editable*. Three committed binaries
// with no way to regenerate them is how an icon becomes something nobody dares touch;
// here the SVG is the source and everything else is output, so changing the mark is
// changing one file and running this.
//
//   npm run icons
//
// Needs `rsvg-convert` (brew install librsvg). The .icns additionally needs `iconutil`,
// which only exists on macOS — on Linux that step is skipped with a warning, because CI
// builds Linux and Windows there and the committed .icns is what a mac build uses.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const RESOURCES = path.join(ROOT, 'resources')
const SOURCE = path.join(RESOURCES, 'icon.svg')

/** Windows wants these; anything larger than 256 cannot go in an ICO as PNG anyway. */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

/** What macOS asks for in an iconset, with the @2x names it insists on. */
const ICNS_ENTRIES = [
  [16, 'icon_16x16.png'], [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'], [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'], [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'], [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'], [1024, 'icon_512x512@2x.png']
]

function render (size, target) {
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), SOURCE, '-o', target])
}

/**
 * An ICO holding PNGs.
 *
 * The format allows it since Vista and every tool this project's packages reach has
 * supported it for longer than that. Writing the container by hand is a few lines and
 * saves a dependency on ImageMagick, which is not installed here and is not worth
 * making a build requirement for 22 bytes of header per image.
 */
function writeIco (pngs, target) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(pngs.length, 4)

  const directory = Buffer.alloc(16 * pngs.length)
  let offset = header.length + directory.length

  pngs.forEach(({ size, data }, index) => {
    const at = index * 16
    // 0 means 256 in this field, which is the whole reason 256 is the largest size here.
    directory.writeUInt8(size >= 256 ? 0 : size, at)
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1)
    directory.writeUInt8(0, at + 2) // palette: none
    directory.writeUInt8(0, at + 3) // reserved
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(data.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += data.length
  })

  fs.writeFileSync(target, Buffer.concat([header, directory, ...pngs.map((p) => p.data)]))
}

function buildIco () {
  const temporary = fs.mkdtempSync(path.join(RESOURCES, '.ico-'))
  try {
    const pngs = ICO_SIZES.map((size) => {
      const file = path.join(temporary, `${size}.png`)
      render(size, file)
      return { size, data: fs.readFileSync(file) }
    })
    writeIco(pngs, path.join(RESOURCES, 'icon.ico'))
    console.log(`  icon.ico    ${ICO_SIZES.join(', ')}`)
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}

function buildIcns () {
  const iconset = path.join(RESOURCES, 'icon.iconset')
  fs.rmSync(iconset, { recursive: true, force: true })
  fs.mkdirSync(iconset)
  try {
    for (const [size, name] of ICNS_ENTRIES) render(size, path.join(iconset, name))
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(RESOURCES, 'icon.icns')])
    console.log('  icon.icns   16 … 512@2x')
  } finally {
    fs.rmSync(iconset, { recursive: true, force: true })
  }
}

/**
 * Linux takes a directory of sizes; electron-builder reads whatever is in it.
 *
 * Named `<size>x<size>.png`, which is the convention it expects and also what a
 * `.desktop` entry's icon lookup walks.
 */
function buildLinuxIcons () {
  const directory = path.join(RESOURCES, 'icons')
  fs.rmSync(directory, { recursive: true, force: true })
  fs.mkdirSync(directory)
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024]
  for (const size of sizes) render(size, path.join(directory, `${size}x${size}.png`))
  console.log(`  icons/      ${sizes.join(', ')}`)
}

function main () {
  if (!fs.existsSync(SOURCE)) {
    console.error(`no ${path.relative(ROOT, SOURCE)} — the icon source is missing`)
    process.exit(1)
  }
  try {
    execFileSync('rsvg-convert', ['--version'], { stdio: 'ignore' })
  } catch {
    console.error('rsvg-convert is not installed (brew install librsvg / apt install librsvg2-bin)')
    process.exit(1)
  }

  console.log('rendering icons from resources/icon.svg')
  render(1024, path.join(RESOURCES, 'icon.png'))
  console.log('  icon.png    1024')
  buildLinuxIcons()
  buildIco()

  if (process.platform === 'darwin') {
    buildIcns()
  } else {
    // Not fatal: the committed .icns is what a mac build uses, and only a Mac can make
    // one. Saying so is better than a build that quietly ships the Electron default.
    console.warn('  icon.icns   skipped — iconutil is macOS only; the committed one stands')
  }
}

main()
