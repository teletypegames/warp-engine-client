# WarpEngine Client 3.1.0

**WarpEngine 1.0 is a version this client knows.** The engine's first major version adds
an Admin API beside the catalog — a JSON API for what the admin does, with an OpenAPI
document and an MCP server — and leaves the catalog alone: the envelope is still `api: 2`,
the titles have the same shape. So 1.0 reads with the same dialect as 0.5 to 0.13, and so do
0.14 and 0.15, which only changed the admin. Before this, a catalog served by 0.14 or later
logged *newer than this client knows* on every fetch, against a shape it read perfectly well.
The version list runs to 1.0, and the exhaustive switch still stops the build when the next
one arrives.

**The service descriptor's `admin` key reaches the log.** A 1.0 engine that has its Admin
API on says so in `GET /api/service`; the log line now ends with *Admin API v1 alongside*.
The client administers nothing — the line is there so a log says exactly what the client
was talking to.

The smoke test's paging server now answers as WarpEngine 1.0.0 and expects the client to
recognise it exactly.

# WarpEngine Client 3.0.0

**The catalog is read a page at a time, and drawn as it arrives.** WarpEngine 0.13
pages `GET /api/software`; the client asks for page 1, follows `nextPage` to the end, and
after every page hands the window a listing built from everything read so far — the same
code that builds the final listing, so nothing drawn early differs from what is drawn late.
The bar counts titles until the last page; what needs the whole (the *Updates* group,
*Upgrade all*, the prune) waits for it. The cache always holds the stitched whole in the
`softwares` shape the shell engine reads, never a partial one, and an older engine, which
ignores `page`, is read as a catalog of one page. `stream:catalogPage` is the fourth
one-way stream from main to the window.

**The grid is windowed.** It draws 48 titles and 48 more each time you near the bottom
of the grid or the list, so a large catalog costs what is on screen. A new filter, search,
store or view starts from the top; a page landing or a screenful more leaves your scroll
where it was — the listing remembers what it last drew and only resets when that changes.

**Categories are called what the catalog calls them.** `GET /api/software/vocabulary`
gives every category key a label; the chips show the label and filter by the key. An
engine without the endpoint keeps the keys, as before.

**A build can be branded.** `make dist BRAND_NAME=… BRAND_STORE=… BRAND_ID=…` bakes a
name and a store into the package: the name is the window title, the bar heading and the
`productName`; the store is installed on the first run without a registry or a picker; the
`appId` and the package names carry the id so a branded and a generic client coexist. The
brand is an alternative default, not a cage — every store on the machine is still listed
and the settings still add and remove them — and it is data the build supplies, never a
store the code knows. `BRAND_NAME` + `BRAND_STORE` at runtime try one out; the settings'
General tab says *Based on WarpEngine Client 3.0.0*.

The version list runs to 0.13. The smoke test proves the paging against a three-page
server of its own and reports the brand; the self-test under `BRAND_NAME` fails unless the
bar carries that name.

# WarpEngine Client 2.11.0

**Search.** A search box in the bar narrows the grid to the titles whose title or name
contains what is typed, with case and accents folded — `love` finds *LÖVE*, `ra` finds
*Blessing of Ra*. It is part of the filter rather than a layer over it: the faceted counts
on the chips already allow for the typed text, *Clear* in the side menu empties the box
along with the axes, and Escape in the box does the same. The text is the one part of the
filter that is never resolved away when the catalog changes: a search that matches nothing
is what the person asked for, and the empty grid says so.

**The engine versions the client admits to knowing.** The supported list ended at 0.5
while the catalog has been served by 0.11 for weeks, so every fetch logged that the engine
was *newer than this client knows* and might drop titles — against a shape it read
perfectly well. The list now runs to 0.12: 0.6 to 0.11 changed storage, CI, images and
the build matrix, none of which is the catalog's shape, and 0.12 adds the optional
`category` the dialect has read since 2.8.0. Two dialects, eleven versions, and the
exhaustive switch still stops the build when a twelfth arrives.

**The store lifecycle test runs in CI.** It adds, renames and removes a store under a
temporary root — the only code in the application that deletes a directory tree — and
needed nothing but Node all along; it now runs in the `check` step beside the smoke test
rather than only on a workstation.

The self-test types the first title's opening into the box, expects the grid to keep that
card and, with more than one title, to lose some, then empties the box and expects
everything back.

# WarpEngine Client 2.10.0

**Settings.** A gear in the bottom-left corner of the side menu opens a dialog with
everything that is not about the catalog in front of you, on three tabs. **General**
holds the language and the default view (grid or list, the same preference the bar's
toggle writes). **Stores** lists the stores on this machine with their id and catalog
address; a pencil renames one in place, a bin removes it with the same warning as
before, and two rows underneath add one — from the registry's list, minus what is
already here, or from a typed catalog address. Adding a store closes the dialog and
opens the store. **Updates** is two blocks, kept apart because they are two different things: this client,
with its version and *Check for updates*; and the installed titles the catalog has a newer
version of, each with an *Upgrade* and an *Upgrade all* above them. The side menu is
back to what it was for: which store, and what to look at. The version number returns to the corner, beside the gear; the hover bin on
the store rows, the *+* and the language globe are gone from the menu.

**Rename is the one edit a store has.** A store is identified by its catalog: the id,
the home folder and the game folder — the boundary of what a removal may delete — all
derive from it, so a store with a different catalog is a different store, and the dialog
does not pretend otherwise. The display name is the only field that is a choice rather
than a derivation, and renaming writes exactly that field into the store's own
`config.json`, atomically, leaving the rest of the file as it was. It is a new bridge
call (`renameStore`) behind the same single-flight guard as the other writes, and the
store lifecycle test now renames the store it adds and reads the file back.

**The dialog is state.** Like the gate, whether the settings are up is one field in the
window's state, and a native `<dialog>` follows it: the focus trap, Escape and the
backdrop come with the element. The store rows are rebuilt only when what they show has
changed, so a rename field is not rebuilt under somebody's fingers by a log line. The
self-test opens the dialog, counts its store rows against the side menu's, closes it,
and — with `SELFTEST_SHOT` — photographs it.

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
