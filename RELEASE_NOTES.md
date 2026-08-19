# WarpEngine Client 2.3.0

**A card says which version you have, and offers the newer one.** Where the catalog has
moved on, an installed title's version line reads `0.1 → 0.3` instead of just the number
on your disk, so the card answers both questions a person came to it with: what is
installed, and is there anything better.

Which version is installed was already recorded — that is what `state.json` has always
been for. What was missing was somewhere to act on it.

**The actions moved into a three-dot menu.** Installed cards now lead with **Play** (or
**Open** for a hosted title) and put the rest behind the ⋮ button beside it:

| | |
|---|---|
| **Upgrade** | fetches whatever the catalog now has, replacing the old payload and menu entry. Greyed out when there is nothing newer |
| **Uninstall** | as before — the payload, the icon and the menu entry, and nothing else |

Upgrade stays visible while disabled rather than appearing and disappearing: a menu whose
items come and go makes a person hunt for the one they used last time, and greyed out
already says "not now".

Playing stays the headline action even when an upgrade is waiting. The version on the disk
still runs, and wanting to play it is not the same as wanting to wait for a download.

**Package names have no spaces.** `WarpEngineClient-2.3.0-arm64.dmg` rather than
`WarpEngine Client-2.3.0-arm64.dmg`, and the same for the AppImage and both Windows
builds — a space in a release asset is a space in every `curl`, script and shell command
that ever touches it. The app is still called **WarpEngine Client**, which is what appears
in the Dock and in `/Applications`; only the file names changed.

### Also

The catalog refresh control's tooltip now says *Refresh the catalog*, because in Hungarian
it and the new Upgrade both wanted the word "Frissítés" and only one of them reloads a
list.

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

The upgrade path was tested on a sandbox store rather than reasoned about. Two titles were
installed, then one of their state records was rewritten to claim an older build — which is
exactly what the engine compares — and the window was asked what it would offer:

```
BombExpert    [newer]   Upgrade:on  Uninstall:on
Rabbit Roller [current] Upgrade:off Uninstall:on
```

Pressing Upgrade runs the same call the window makes, and the record went from `0.1` to
`0.2` with the old payload removed first. The self-test now asserts that pairing on every
installed card, because a closed menu photographs identically whether or not its items are
right.

The new package names were read off a real build (`WarpEngineClient-2.3.0-arm64.dmg`,
`…-arm64-mac.zip`) and checked against the release script's own file filter, which finds
both. The Windows names are `-Setup-` and `-Portable-` so the two `.exe` targets cannot
resolve to one name and overwrite each other.
