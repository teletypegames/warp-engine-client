# WarpEngine Client 2.7.0

**The Commodore titles install.** A C64 or Plus/4 release used to be a cartridge and
nothing else, and a cartridge is data for an emulator, so the two platforms were off by
default and their cards said *unsupported platform*. Since WarpEngine 0.11 those releases
also carry native players — yapeSDL for Linux, Windows and macOS, wrapped with a launcher
named after the game that sets the machine type and autostarts the cartridge — and a
browser build. Both platforms are on now, and install the way every other native title
does.

That launcher is why program discovery changed: an archive shipping an emulator next to
a launcher script names the launcher after the game precisely so that it is the thing to
run. A program named after the game now wins outright, before the shallowest `.app` and
before the single-executable rule; `.bat` and `.cmd` count as programs on Windows and
start through `cmd.exe`, since Node will not exec a batch file. The zip reader restores
symlinks as symlinks — the SDL2 framework inside yapeSDL's `.app` is a tree of them.

**Platforms have names.** The cards and the category list said `plus4`, `tic80`, `love`.
They now say what the catalog calls them — *Plus/4*, *TIC-80*, *LÖVE* — read from the
server's build matrix (`GET /api/builds`) so a catalog can add a platform without a new
client; an engine without the endpoint, or a machine offline, keeps the slugs.

# WarpEngine Client 2.6.1

**The window comes back.** 2.6.0 opened to an empty window: no stores, no cards, no box
art, and nothing in the log to say why. The list view it introduced put two inline `<svg>`
icons into the view toggle, and the top bar asked for them as `HTMLElement`. An inline
`<svg>` is an `SVGSVGElement`, which is not one, so the element check that guards every
id in `index.html` did exactly what it is for — it threw — in the first constructor the
renderer runs. Nothing after it ran either.

Two things changed. The icons are asked for by their real type. And hiding an element now
toggles the `hidden` *attribute* rather than assigning the property: on an SVG element the
property is not there, so assigning it would have created a plain field and hidden
nothing, which is the bug that would have followed this one.

The headless smoke test could not have seen this — it has no window. The window check
(`npm run uitest`) fails on it in the first second.

Nothing else changed: same store handling, same catalog, same sign-in.
