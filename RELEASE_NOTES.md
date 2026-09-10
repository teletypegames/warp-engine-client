# WarpEngine Client 2.9.0

**Check for updates.** The side menu shows the version number, and now a *Check for
updates* link beside it. It asks the client's own release list on the forge for the newest
published release and answers in place: *This is the latest version*, or *Version X is
available* with a button that opens the release page in the browser, where the package
for this machine is. The app does not update itself and does not ask on its own — a
store that phones home at start-up is a different kind of program — so nothing happens
until someone clicks. The check is a port (`ClientReleaseGateway`), a service and one
bridge call, and the smoke test reads the feed and checks the version comparison.

**Reinstall.** The three-dot menu on an installed card gains *Reinstall* between
*Upgrade* and *Uninstall*. Refresh and Upgrade leave an install they find intact, which
is right for a sync and wrong for a copy that stopped working in a way the record cannot
see — a payload edited by hand, a launcher that no longer starts. Reinstall removes the
copy first, so the installer sees nothing there and unpacks the payload, writes the icon
and the menu entry again from the catalog. A title the catalog no longer has, or this
machine cannot install, is logged and left alone.

# WarpEngine Client 2.8.0

**The filter has axes.** The side menu used to offer one list of categories — a status,
a platform or a kind, one of them at a time — so "the installed Plus/4 titles" was not a
thing it could show. The list is now a filter with four axes that combine: the status of
a title on this machine (a list, exactly one on), the platform, the kind (native or
hosted) and the category, the last three as chips that switch on and off. Every count is
faceted — it says how many titles the option would show given the other axes as they
stand — and *Clear* appears while anything is narrowing the catalog. An axis the catalog
has no second value for is not drawn.

**Category comes from the catalog.** The dialect reads an optional `category` on a
software record and carries it to the window as `GameDto.category`; the category axis
appears once a catalog publishes one. WarpEngine does not yet, so the axis stays hidden
until it does. It is not written into `state.json`, which keeps the file the shape the
other store clients write.

**Under the hood, the window follows its own rules again.** An audit against
STRUCTURE.md found the drift: log lines living in a view, controllers writing to that
view, a gate shown and hidden by calls, mappers and null objects constructed in
constructor defaults, casts on data that came over the bridge or off the disk, and a
list view that had grown its own copies of the card's pieces. All of it is put back where
the map says it goes — the log is state, every view has one `render(state)`, wiring
happens only in the three composition roots, foreign data goes through `JsonRecord`, and
the list draws with the card's art, version and menu. Nothing visible changed except the
version line in the list, which now says just the number.

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
