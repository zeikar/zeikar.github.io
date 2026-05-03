---
title: "Chrome Extension Iframe Auth: From chrome.cookies to CHIPS"
subtitle: "How a Chrome extension's iframe survives third-party cookie blocking — without bypassing the browser."
date: 2026-05-03
lang: en
translations:
  ko: /blog/ko/from-chrome-cookies-to-chips/
description: "Authenticating a Chrome extension's iframe under third-party cookie blocking — the chrome.cookies API trap, the CHIPS Set-Cookie solution, and the diff in between."
---

This is a story about authenticating a Chrome extension's iframe in a world that blocks third-party cookies — specifically, why the `chrome.cookies` API was the wrong tool and the standard CHIPS `Set-Cookie` attribute was the right one.

A surprisingly mechanical change in the end. The path there was a sharp lesson on what *bypassing the browser* actually costs you.

The setup is small: [Commentarium](https://commentarium.app) is a comments app for any URL, and the [Chrome extension](https://github.com/zeikar/commentarium-extension) injects a side panel on every page with `commentarium.app/comments?url=…` in an iframe. So the iframe is `commentarium.app` content embedded in arbitrary top-level sites — a textbook third-party context.

Modern browsers block third-party cookies by default. The iframe's session cookie won't stick, the user can't sign in, no comments. The whole product is dead in a third-party context.

We had a plan. It worked. Then it didn't.

## First attempt: writing partitioned cookies via chrome.cookies

The MV3 broker pattern is well-established: the service worker is the source of auth state, and the iframe talks to it via `chrome.runtime.sendMessage` (gated by `externally_connectable.matches`). On sign-in, the SW would:

1. Get a Firebase ID token via `chrome.identity.getAuthToken` and `signInWithCredential`.
2. POST `/api/login` with `Authorization: Bearer <idToken>`.
3. Receive `{ session, expiresAtSeconds }` from the server.
4. Write the session cookie itself, partitioned: `chrome.cookies.set({ url, name: "session", value, partitionKey })`.

Step 4 was the clever bit. `chrome.cookies` had recently picked up `partitionKey` support (Chrome 119+), so the SW could write a cookie scoped to the iframe's CHIPS partition jar. Unit tests passed. Manual smoke on `localhost` worked. We shipped to a colleague for QA.

The next morning: works on the page they tested first; fails everywhere else.

The catch is buried in the Chrome docs:

> `chrome.cookies.set` for a partitioned cookie requires `host_permissions` for the **partition's top-level site** — not the cookie's host.

Read it again. The extension already had `host_permissions: ["https://commentarium.app/*"]`, which lets it write cookies *for* `commentarium.app`. That doesn't cover the partition jar's top-level site. The iframe lives on `https://example.com`, so to write a partitioned cookie there, the extension needs permission for `example.com`.

The "fix" is `host_permissions: ["<all_urls>"]`. It works. It also makes the install dialog read **"Read and change all your data on the websites you visit."** For a side-panel extension with one job, that warning is brutal. Half your users bounce.

We could not justify the trust cost.

## The aha moment

Sometimes you stare at a problem long enough that the obvious solution surfaces: we don't actually need `chrome.cookies` at all. The browser already knows how to write a partitioned cookie if you ask politely. There's a standard cookie attribute for it.

```http
Set-Cookie: session=…; Partitioned; SameSite=None; Secure; HttpOnly; Path=/
```

That's [CHIPS](https://developer.chrome.com/docs/privacy-security/privacy-sandbox/chips) — Cookies Having Independent Partitioned State. Set the attribute, the browser drops the cookie into the iframe's partition jar (keyed by the embedding top-level site, exactly what we want) and serves it back on subsequent same-iframe requests. No `host_permissions` needed, because the *server* is writing the cookie, not the extension.

This is what CHIPS was designed for. We were trying to bypass it.

## Second attempt: server-side Set-Cookie with the CHIPS attribute

The redesign collapses the SW into a thin token vendor:

```ts
// SW broker — vends idTokens, never touches cookies or fetch
async function refreshSessionOp(): Promise<AuthResponse> {
  if (!auth.currentUser) {
    await performSignOutCleanupBestEffort();
    return {
      error: { code: "auth/no-current-user", message: "no signed-in user" },
      signedOut: true,
    };
  }
  const idToken = await auth.currentUser.getIdToken(true);
  return { ok: true, idToken };
}
```

The iframe — which is in 1st-party `commentarium.app` context, even when embedded — calls `/api/login` itself:

```ts
// iframe (1st-party context)
const { idToken } = await broker.refreshSession();
await fetch("/api/login", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${idToken}`,
    "X-Commentarium-Surface": "extension",
  },
});
```

And the server writes the cookie:

```ts
// /api/login route handler
const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
cookies().set({
  name: "session",
  value: sessionCookie,
  httpOnly: true,
  secure: true,
  sameSite: "none",
  partitioned: isExtensionSurface, // <-- the entire CHIPS change
});
```

The browser drops it into the right partition jar. The next request from the iframe carries it. Done.

## What the diff looked like

The two approaches, side by side:

| | chrome.cookies path | CHIPS path |
|---|---|---|
| `permissions` | `activeTab`, `identity`, `storage`, **`cookies`** | `activeTab`, `identity`, `storage` |
| `host_permissions` | `<all_urls>` (or broken) | (none) |
| `minimum_chrome_version` | `132` (for `getPartitionKey`) | `114` (CHIPS GA) |
| Install dialog | "Read and change all your data..." | minimal |
| SW lines for auth | ~300 (mint, partition registry, cleanup) | ~230 (token vending only) |

No `host_permissions`, no `cookies` permission, a **lower** Chrome floor (CHIPS shipped earlier than the partition-key APIs we depended on), and one less explicit security warning at install. About 70 lines of partition-registry bookkeeping deleted from the SW.

## Bonus: cross-partition logout with revokeRefreshTokens

`auth.revokeRefreshTokens(uid)` invalidates all of a user's refresh tokens server-side. With each authenticated route using `verifySessionCookie(cookie, /* checkRevoked */ true)` on the extension surface, a logout on any partition propagates: other partitions' cookies stay physically in their jars but fail validation on the next request. The UI catches the resulting 401 and flips signed-out via a custom `commentarium:signed-out` event. Clean.

(One nuance we deliberately left out: the 1st-party `commentarium.app` direct-visit context uses an unpartitioned cookie and a separate sign-in surface, so logging out of the extension does not log you out of `commentarium.app` you opened directly. That's the same model as Slack desktop vs. Slack browser — the surfaces are intentionally distinct.)

## Takeaways

1. **Before reaching for a Chrome API workaround, look at the cookie spec.** CHIPS exists precisely for this case — partitioned cookies for embedded contexts. We had read the `chrome.cookies` docs four times before reading the cookie attribute docs once.
2. **Manual E2E catches what unit tests cannot.** The chrome.cookies failure was *only* visible on a real page hosted on a real second domain. Unit tests passed. Browser permission semantics are too easy to mock past.
3. **The thinner the service worker, the better.** Once the SW is just *vend ID tokens*, the surface area for surprise shrinks. Most of the deleted lines were carrying sample-of-one assumptions about partition semantics.
4. **CHIPS is Chrome / Edge today.** Firefox is implementing; Safari has different opinions. For a Chrome-Web-Store extension, this is fine. For a cross-browser extension, you'd need a different shape entirely.

The diff was wildly in our favor. The hardest part was admitting the first design was the wrong shape.

---

*Code: [commentarium-extension](https://github.com/zeikar/commentarium-extension). The CHIPS redesign landed as [extension PR #2](https://github.com/zeikar/commentarium-extension/pull/2).*
