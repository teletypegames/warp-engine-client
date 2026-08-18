# WarpEngine Client 2.0.0

**The store engine is part of the app. Nothing has to be installed on the machine any
more.** Reading the catalog, choosing which release fits your computer, downloading and
unpacking it, writing the menu entry and remembering what went where all happen inside
the application now. There is no Python to find, no child process, and no JSON protocol
between the two halves — which is why this is a major version rather than a feature.

What that changes for a person: on Windows and on a fresh Mac the app simply works.
Before it looked for `python3`, `python` and `py -3`, and where none answered it drew a
screen with a link to python.org instead of a catalog. That screen is gone, along with
the one that offered to refresh a store engine too old to drive.

**Your existing library is kept.** `config.json` and `state.json` on disk are unchanged —
the same field names, the same `<scope>:<name>` keys, the same file modes — so a machine
whose games were installed by the shell store keeps them. Opening this version against
such a store lists them as installed, offers no needless update, and a sync reports
*already up to date*. A `version: 1` state file is still migrated on first read.

The two Python files an earlier install left in the store folder are removed the next
time that store is set up. Nothing reads them, and a folder that still looks like it
holds the engine invites someone to run it against a state file this app is also writing.

**The client knows which WarpEngine served a catalog.** Every WarpEngine API response
carries a `WarpEngine-Version` header, and the client now reads it, names the version in
the log, and picks the catalog dialect for it. `SUPPORTED_WARP_ENGINE_VERSIONS` lists what
this build was written against — 0.2, 0.3 and 0.4 — and the four cases are all handled:

| The header says | What the client does |
|---|---|
| a supported version | reads the catalog with that version's dialect |
| nothing at all | reads it as the oldest supported version — an engine before 0.4.0 sent no header |
| something older | the same, and says so in the log |
| something newer | tries the newest dialect anyway, warning that titles may be missed |

Adding a version to that list fails the build until somebody says what it reads like, in
the type checker and in the linter both. A new engine version cannot arrive unnoticed.

**Refresh and the language picker are icons.** They sit together at the foot of the side
menu, and the *Actions* heading that used to head a section of one button is gone. Both
carry their name as a tooltip and to a screen reader, and the language picker is still a
real `<select>` underneath — the native dropdown, keyboard and all, with only the glyph
showing.

### Also

No runtime dependencies, still: the zip reader the installer needs is about 150 lines over
`node:zlib` rather than a package. It restores the executable bit from each entry's
external attributes, which is what makes an unpacked game able to start at all, and it
refuses a zip64 archive, an unknown compression method or an entry that would be written
outside its destination rather than guessing.

The repository itself is free of Python too — the Makefile, the CI check and the release
script read `package.json` and the forge's JSON with Node now.

### Opening it on macOS

Ad-hoc signed, **not notarised**, so macOS asks first:

```sh
xattr -dr com.apple.quarantine "/Applications/WarpEngine Client.app"
```

### What is attached

The macOS package, built and verified on a Mac, plus the Linux (AppImage, deb) and
Windows (installer, portable) packages the pipeline builds when the tag is pushed.

### Verified

`make check` is clean: typecheck, lint, the headless smoke test and the window self-test.

The new engine was measured against the old one rather than trusted. On the same catalog
and the same config, the Python engine and this one produce **the same 13-title listing
with zero field differences** and the same resolved paths. Installing three titles — a
bare TIC-80 binary wrapped in a bundle, a Godot `.app` symlinked, and a hosted web entry —
gives **byte-identical payloads, identical file modes and an identical `Info.plist`**; the
only difference in the two trees is the sandbox path inside the generated launcher script.
`state.json` matches record for record.

The upgrade path was tested directly: pointed at a store home installed by the Python
engine, this one reports all three titles installed with no update available, and a
re-sync writes nothing. Remove, prune, prune-suppression on a named sync, and the v1→v2
state migration were each exercised. The zip reader was checked against Python's
`extractall` on an archive holding stored, deflated, directory and symlink entries —
identical bytes and identical modes — and its zip-slip and not-a-zip guards both fire.
