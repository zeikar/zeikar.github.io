---
title: "Chrome Extension Iframe Auth: From chrome.cookies to CHIPS"
subtitle: "To get a login cookie into an iframe under third-party cookie blocking, the extension wrote the cookie itself, and that needed cookie access to every site. The server only had to send the cookie with the Partitioned attribute."
date: 2026-05-03
unit: commentarium
last_modified_at: 2026-11-18
lang: en
translations:
  ko: /blog/ko/from-chrome-cookies-to-chips/
description: "Signing in a Chrome extension's iframe under third-party cookie blocking: the permission problem with writing partitioned cookies via chrome.cookies, and the fix of having the server send a CHIPS (Partitioned) cookie."
---

[Commentarium](https://commentarium.app) is a web app for commenting on any URL. Its [Chrome extension](https://github.com/zeikar/commentarium-extension) uses a content script to attach a comment panel to every page, and the panel holds a `commentarium.app/comments?url=…` iframe. So the iframe is a `commentarium.app` page embedded in whatever site you're on: a textbook third-party context.

Chrome blocks third-party cookies by default in Incognito, and one setting blocks them in normal windows too. Once they're blocked, the iframe's session cookie doesn't stick, so you can't sign in, and without signing in you can't comment. This post is about getting sign-in to work in that iframe.

## Writing the partitioned cookie with chrome.cookies

The first design was the usual MV3 broker. The service worker holds the auth state, and the iframe talks to it with `chrome.runtime.sendMessage` (gated by `externally_connectable.matches` to `commentarium.app`). On sign-in, the service worker did this:

1. Get a Firebase ID token with `chrome.identity.getAuthToken` and `signInWithCredential`.
2. POST to `/api/login` with `Authorization: Bearer <idToken>`.
3. The server returns `{ session, expiresAtSeconds }`.
4. The service worker writes that session value into the iframe's cookie partition with `chrome.cookies.set({ url, name: "session", value, partitionKey })`.

Step 4 was the point. Partitioned cookies (CHIPS) survive third-party cookie blocking, so the service worker looked up the iframe's partition key with `chrome.cookies.getPartitionKey` (Chrome 132+) and put the cookie there. Unit tests passed, and clicking through it on localhost worked.

## Partitioned cookies need the top-level site's permission

On real sites, the cookie didn't get written. Testing it by hand showed why: to write a partitioned cookie with `chrome.cookies.set`, you need `host_permissions` for the partition's top-level site, not for the cookie's host (`commentarium.app`). The extension only had `host_permissions: ["https://commentarium.app/*"]`. With the iframe on `https://example.com`, it needs `example.com`, and since this extension shows up on every site, that means `<all_urls>`.

`<all_urls>` makes it work. But holding the `cookies` permission together with host access to every site lets the extension read and write the cookies of every site the user is signed in to. That's not a permission a comment panel should have, and the Chrome Web Store looks harder at broad host permissions in review. So I dropped that route.

## The server sends the cookie as Partitioned

Looking back, `chrome.cookies` was never needed. The browser already knows how to write partitioned cookies, and there's a standard cookie attribute to ask for one.

```http
Set-Cookie: session=…; Partitioned; SameSite=None; Secure; HttpOnly; Path=/
```

That's [CHIPS](https://privacysandbox.google.com/cookies/chips) (Cookies Having Independent Partitioned State). The browser puts a cookie with this attribute into the iframe's partition (keyed by the embedding top-level site) and sends it back on the next request from that partition. The server writes the cookie, not the extension, so no `host_permissions` are needed.

In the new design the service worker only hands out ID tokens. With no signed-in user it cleans up and returns signed-out; it never touches cookies or calls `/api/login`. The iframe calls `/api/login` itself. The iframe is a third-party context, but code inside it calling `/api/login` is a request to its own origin.

```ts
// iframe code
const { idToken } = await broker.refreshSession();
await fetch("/api/login", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${idToken}`,
    "X-Commentarium-Surface": "extension",
  },
});
```

When the request comes from the extension, the server marks the cookie `Partitioned`.

```ts
// /api/login route handler (simplified)
const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
cookies().set({
  name: "session",
  value: sessionCookie,
  httpOnly: true,
  secure: true,
  sameSite: "none",
  partitioned: isExtensionSurface, // this line is the CHIPS part
});
```

Each top-level site gets its own partition, so when you open the panel on a new site, that partition has no cookie yet. The iframe then gets a token from the service worker and calls `/api/login` once, and the cookie for that site appears. That's why the service worker still holds the auth state.

CHIPS shipped in Chrome 114, so the extension's minimum version dropped from 132 (raised for `getPartitionKey`) to 114. Firefox supports it from 141, and Safari added it in 18.4, pulled it, and supports it again from 26.2. That's enough for a Chrome Web Store extension; for other browsers, check the [support table](https://caniuse.com/mdn-http_headers_set-cookie_partitioned) first.

## The manifest, before and after

| | chrome.cookies route | CHIPS route |
|---|---|---|
| `permissions` | `activeTab`, `identity`, `storage`, `cookies` | `activeTab`, `identity`, `storage` |
| `host_permissions` | needs `<all_urls>` | even `https://commentarium.app/*` is gone |
| `minimum_chrome_version` | `132` (`getPartitionKey`) | `114` (CHIPS) |
| Service worker auth code (`auth.ts`) | 336 lines | 235 lines |

## A cookie per partition, and signing out

CHIPS has one cost. Cookies stay separate per partition, so signing out on one site leaves the cookies in other sites' partitions. Sign-out therefore revokes on the server instead of deleting cookies. `auth.revokeRefreshTokens(uid)` invalidates all the user's refresh tokens, and requests from the extension are checked with `verifySessionCookie(cookie, true)`, which includes revocation. A cookie left in another partition fails verification on its next request, and the UI turns a 401 into the `commentarium:signed-out` event and shows the signed-out state.

A tab where you open `commentarium.app` directly is a separate sign-in with an ordinary, unpartitioned cookie. Signing out on the web triggers the same revocation, so the extension signs out too, but signing out in the extension leaves that tab signed in.

The CHIPS change was merged in [extension PR #2](https://github.com/zeikar/commentarium-extension/pull/2).

*This post first described the cost of `<all_urls>` as the install dialog's "all websites" warning. The content script already runs on every site, though, so that warning showed up all along. In November 2026 I corrected it to the real cost, the scope of cookie access.*
