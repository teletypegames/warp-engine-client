# WarpEngine Client 2.5.1

**The app has an icon.** Until now every build shipped the default Electron one —
`electron-builder` said so on every run, in a line easy to read past: *"default Electron
icon is used, reason=application icon is not set"*. A store you install games with
should not look like a framework demo in the Dock.

The mark is a **W with three lines running into it**: the product's initial, and what it
is doing. It uses the window's own palette, so the icon and the application it opens are
the same object. It was drawn for the smallest size first — at 32px the W still reads
and the lines survive as motion rather than as noise. A portal, a play triangle and a
send arrow were each tried and each discarded: they already mean a loading spinner, a
media player and a submit button.

`resources/icon.svg` is the source and the only file to edit. `make icons` renders the
`.png`, the `.ico`, the `.icns` and the Linux size directory from it — three committed
binaries with no way to regenerate them is how an icon becomes something nobody dares
touch.

The window also picks it up when run from source, where there is otherwise no icon to
carry and a dev run looks like a different application from the one being built.

Nothing else changed: same store handling, same catalog, same sign-in.
