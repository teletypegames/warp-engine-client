# WarpEngine Store 1.2.0

**A side menu.** Everything that is not a title moved out of the bar into a menu on
the left that folds away with `☰`: the stores on this machine, the two actions, the
categories and the language. Open or closed is remembered between runs.

**Categories.** The grid narrows to *Installed*, *Updates* or *Not installed*, to a
platform (`godot`, `tic80`, `love`, …), or to native/hosted titles — one at a time,
each with its count. The axes are built from what the catalog actually contains, so
nothing empty is listed, and a category that disappears under you falls back to
*Everything* rather than leaving a blank grid.

**Switching stores.** With more than one store installed, clicking another in the
menu opens it: the grid, the categories and the folders follow, and the client
reopens on the store last used. Two stores installed from the same catalog into
different folders are told apart by their folder, since their id is identical.

While the store is working, the menu, the log drawer and the filters keep working —
only what would start a second call is disabled.

**The grid was broken, and now is not.** Its rows split the window's height evenly
rather than following their content, so every card came out 94px tall: the box art
collapsed to nothing and the action buttons were clipped away below the fold. The
DOM was intact the whole time — ten cards, twenty buttons — which is why every
automated count passed. Cards now carry a band of art of one height, with the
title's first letter where the catalog has no image.

Unchanged from 1.1.0: which stores exist is the site's answer (`GET /api/stores`),
not something baked into this app, and `STORES_API` overrides that address.

### Opening it on macOS

Ad-hoc signed, **not notarised**, so macOS asks first:

```sh
xattr -dr com.apple.quarantine "/Applications/WarpEngine Store.app"
```

*Open Anyway* under **System Settings ▸ Privacy & Security** works as well.
Nothing the store itself downloads is affected — Python fetches those, and Python
does not set the quarantine flag.

### What is attached

**macOS arm64 only**, the machine this was built and verified on. Windows and
Linux packages need a build on those platforms (`make dist-win` / `dist-linux`).

### Verified

`SELFTEST_SHOT=shot.png npm run uitest` has the window photograph itself, which is
how the collapsed rows were found and how the fix was confirmed — in English and in
Hungarian, with the menu open and closed.

`npm run uitest` loads the window and reports what rendered; with two stores in one
root — a sandbox copy beside the real install — it now also clicks the store that
is not open and checks that the bar, the grid and the categories follow. Both runs
pass, and `npm run smoke` drives the same bridge with no window at all: ten titles,
five native and five hosted, every installed one with something to launch.
