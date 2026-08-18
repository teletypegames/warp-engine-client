# WarpEngine Client 1.5.0

**The app is called WarpEngine Client.** It was WarpEngine Store, which named the thing
it opens rather than the thing you run — and the store is a catalog on a site, not a
window on your machine. The window title, the packages, the bundle and the menu entry all
say Client now; the repository already did. The store the window is driving is named in
the side menu, so the bar no longer repeats it as a badge.

**Every title in the catalog is listed, including the ones this machine cannot install.**
A C64 cartridge on a desktop, or a game with no build for your operating system, used to
be silently absent — leaving you to wonder whether the catalog is small or your machine
is unusual. Those cards are now there, dimmed, with an *unsupported platform* or *no
build for this machine* badge and the engine's own sentence underneath, and with nothing
to press. They have a category of their own, *Not for this machine*, and they stay out of
the native/hosted counts: a title with no build has no mode to be counted under.

This needs store engine **1.2.0** (desktop) on **warpstore 1.4.0**, which report what
they had to leave out and why. An older engine still works — its listing is simply all
installable, as it was before.

**A build can be pointed at another site's registry.**

```sh
make dist STORES_API=https://games.example.org/api/stores
```

The address is written into the packaged app's own `package.json`, so a client built for
somebody else's catalog needs no source change and nothing set on the user's machine. A
runtime `STORES_API` still wins, which is for trying something out rather than shipping.

### Also

The scrollbars are the window's own now: the platform's light track down the side menu of
a dark window looked like a mistake.

### Opening it on macOS

Ad-hoc signed, **not notarised**, so macOS asks first:

```sh
xattr -dr com.apple.quarantine "/Applications/WarpEngine Client.app"
```

### What is attached

The macOS package, built and verified on a Mac, plus the Linux (AppImage, deb) and
Windows (installer, portable) packages the pipeline builds when the tag is pushed.

### Verified

`make check` is clean. The store on this machine lists 13 titles — ten installable, three
C64 cartridges this store does not carry — and the window was photographed with all
thirteen on screen, the three dimmed and labelled. The engine change was measured through
the CLI as well, in both its human and its `--json` listing, and the other two store
engines still get the two-value answer they ask for.
