# WarpEngine Client 2.5.0

**A store can be taken off the machine again.** Hovering a store in the side menu shows
a bin. It asks first, and says how many titles will go with it — because removing a
store *uninstalls what it installed*. That is not a convenience: a store's `state.json`
is the only record of which payloads, icons and menu entries belong to it, so leaving
the games behind would leave orphans nothing could ever identify, least of all a later
install of the same store into the same folder. The catalog cache, the settings and any
sign-in token go too.

**Adding one moved to a + beside Refresh**, and it now takes a catalog address of your
own as well as the ones the registry lists. A bare host is enough — `https` is assumed —
and the name is taken from the address. Both are actions on the whole store rather than
on one of them, which is why they sit together; the full-width "Add a store…" button
under the list read as a third store.

**The picker has a way out.** Opening it with a store already installed used to be a
trap: the grid was replaced and nothing short of installing something brought it back.

**Two things found by the new test.** `make storetest` adds and removes a store in a
sandbox, because removal is the only code here that deletes a directory tree and the
path it deletes is named by the window. It immediately caught that `http://` was
accepted and became a store called *http* — the trailing slashes were being stripped
before the scheme was checked — and that `STORE_ROOT` only *prepended* to the search
path, so a "sandboxed" run still listed the real stores. With a delete button in the
window, a sandbox that can reach a working installation is not a sandbox; it replaces
the search path now.

**`btn-secondary` had no styling at all.** It was introduced in 2.4.0 on the card's
sign-in button and on the sign-in panel, and rendered as a plain button in both places.
