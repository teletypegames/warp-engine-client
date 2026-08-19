# WarpEngine Client 2.4.0

**The catalog can now say a title is not yours, and the client can do something about
it.** Where a store sells things, a card shows the **price** and a **Buy** button that
opens the store's own page; where you own it, an **Install** as before. Two new
categories go with it — **Owned** and **To buy** — because owning something is not the
same as having installed it.

**Signing in, without a password ever reaching this window.** The side menu grows an
**Account** block, and signing in shows a short code: your browser opens on the store's
own page and you type it there. That detour is the point — a desktop application asking
for a password is a desktop application people should not be giving one to. The token
lives in the OS keychain (Keychain, libsecret, DPAPI), one per store, and *Sign out*
revokes it at the server as well as forgetting it here.

**None of this is knowledge about any particular store.** It all arrives from the
catalog's own server: WarpEngine 0.5 answers `GET /api/service` with what it offers, and
puts an `access` block on every entry. A client that carried those facts would work for
exactly one shop — this one asks, which is why the same build serves any of them.

**A store with no sign-in shows none.** Every WarpEngine before 0.5 has no descriptor at
all, and a 0.5 store that sells nothing reports none either. Both read as "a plain
catalog", which is what this client assumed for its whole life until now, and the window
behaves accordingly: no Account block, no prices, no new categories.

**A title nobody has bought is not dimmed.** The dimming and the dashed badge belong to
what this *machine* cannot do — an unsupported platform, no build for this architecture
— and there is nothing wrong with the machine when a title simply costs money.

**A bearer token is never sent to a host that did not issue it.** A gated download
answers with a redirect to signed storage, often somebody else's server, and some object
stores refuse a request outright when an `Authorization` header rides along with the
signature. The credential stops at the origin it belongs to; a redirect back to the
catalog keeps it.
