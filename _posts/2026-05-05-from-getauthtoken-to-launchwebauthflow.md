---
title: "When getAuthToken Misses a Cancelled Sign-in in a Chrome Extension"
subtitle: "Closing the account chooser sometimes produced no answer at all, so a keepalive and a timeout held the line until launchWebAuthFlow, which reports a cancel reliably, made both unnecessary."
date: 2026-05-05
unit: commentarium
last_modified_at: 2026-11-18
lang: en
translations:
  ko: /blog/ko/from-getauthtoken-to-launchwebauthflow/
description: "When chrome.identity.getAuthToken drops its cancel callback: why a keepalive and timeout ran into Chrome's 5-minute limit, and the move to launchWebAuthFlow."
---

The [Commentarium](https://commentarium.app) extension puts a comments iframe on every page, and its service worker handles sign-in on the iframe's behalf; the [previous post](/blog/from-chrome-cookies-to-chips/) covers that setup. When the iframe asks for Google sign-in over `chrome.runtime.sendMessage`, the service worker used to sign in to Firebase like this:

```ts
const { token: accessToken } = await chrome.identity.getAuthToken({ interactive: true });
const credential = GoogleAuthProvider.credential(null, accessToken);
await signInWithCredential(auth, credential);
```

Chrome's account chooser opens, the user picks an account, an access token comes back, and it becomes a Firebase credential. That holds until the user closes the chooser without picking anything.

## Closing the account chooser

Close the chooser and the sign-in button kept spinning. Eventually "Authentication failed" appeared, and the iframe's console had this:

```
Unchecked runtime.lastError: A listener indicated an asynchronous response by returning true,
but the message channel closed before a response was received
```

The service worker's message handler had returned `true`, promising an async reply, and was awaiting `getAuthToken`. Normally, closing the chooser makes Chrome reject that Promise with `"The user did not approve access."` Sometimes, though, the callback never came. The Promise neither resolved nor rejected, and the await just sat there.

MV3's service worker lifetime rules do the rest. Each event or extension API call restarts a 30-second idle timer, and with nothing happening the worker is shut down. A stuck await counts as nothing, so about 30 seconds later the worker goes away, the message channel closes, and the iframe gets a bare channel error. To the user it's a failure with no reason attached.

## A keepalive and a timeout

The first move was to keep the service worker alive and put a ceiling on the callback that wasn't coming:

```ts
async function signInGoogleOp(): Promise<AuthResponse> {
  // Keep the service worker alive while OAuth is pending.
  const keepAlive = setInterval(() => {
    void chrome.runtime.getPlatformInfo().catch(() => {});
  }, 20_000);

  // Race a timeout so a callback that never comes still ends at a ceiling.
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject({ code: "identity/timeout", message: "..." }),
      5 * 60 * 1000);
  });

  try {
    const tokenResult = await Promise.race([
      chrome.identity.getAuthToken({ interactive: true }),
      timeoutPromise,
    ]);
    // ...rest unchanged
  } finally {
    clearInterval(keepAlive);
  }
}
```

`chrome.runtime.getPlatformInfo()` is the lightest `chrome.*` call with no side effects, so calling it every 20 seconds keeps resetting the idle timer. The timeout returns a named error, `identity/timeout`, when the callback never arrives.

The first timeout was five minutes, and review caught it before the commit. Chrome [terminates a service worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) when a single event or API request takes longer than five minutes, keepalive or not. Once the chooser opened, the `getAuthToken` call was exactly that request, so a five-minute timeout was racing the limit. If Chrome shut the worker down first, the timer never fired and we were back to the original channel error.

So the timeout [went in at 60 seconds](https://github.com/zeikar/commentarium-extension/commit/4134ae2). The error now had a name, but a user who closed the chooser still waited a full minute to see it. All the keepalive bought was a service worker alive enough to say "gave up" 60 seconds later. The problem wasn't the worker's lifetime; the cancel signal was getting lost somewhere inside `getAuthToken`, and nothing outside it could fix that.

## Switching to launchWebAuthFlow

`chrome.identity` has two interactive sign-in APIs:

| API | What it opens | Cancel signal |
|---|---|---|
| `getAuthToken` | Chrome's internal account chooser | Sometimes never arrives |
| `launchWebAuthFlow` | A regular browser window at an OAuth URL | Promise rejects when the window closes; `error=access_denied` in the redirect URL fragment if the provider denies |

`launchWebAuthFlow` opens a real browser window. When the user closes it, Chrome reliably rejects the Promise, and there's no internal UI in between to swallow the close. The price is giving up `getAuthToken`'s "just hand me a token" convenience: you build the OAuth URL yourself and parse the fragment of the redirect URL that comes back.

To leave the Firebase side alone, the flow uses `response_type=token`. The redirect then carries an `access_token`, which goes into `GoogleAuthProvider.credential(null, accessToken)` exactly as before. Unlike an ID-token flow, there's no nonce to verify.

```ts
async function signInGoogleOp(): Promise<AuthResponse> {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_OAUTH_WEB_CLIENT_ID,
    redirect_uri: chrome.identity.getRedirectURL(),
    response_type: "token",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  let responseUrl: string | undefined;
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      interactive: true,
    });
  } catch (err) {
    return { error: { code: "auth/popup-closed-by-user", message: "..." } };
  }

  // (URL parse failures and a missing access_token are handled too; omitted here)
  const fragment = new URLSearchParams(new URL(responseUrl!).hash.slice(1));

  // Verify state first, before reading any other field.
  if (fragment.get("state") !== state) {
    return { error: { code: "identity/state-mismatch", message: "..." } };
  }

  const oauthError = fragment.get("error");
  if (oauthError) {
    return {
      error: {
        code: oauthError === "access_denied"
          ? "auth/popup-closed-by-user"
          : "identity/oauth-error",
        message: fragment.get("error_description") ?? oauthError,
      },
    };
  }

  const accessToken = fragment.get("access_token");
  // ...Firebase sign-in, identical to before
}
```

A cancel, whether a closed window or `access_denied`, comes back as `auth/popup-closed-by-user`. That's the code Firebase produces when a user closes a `signInWithPopup` window on the web, so the webapp's login modal already had a branch that shows "Sign-in was cancelled" for it. Nothing in the webapp had to change.

`state` is checked before any other fragment field. Success and error redirects both echo it back, so checking it first means everything after works only with values that passed the CSRF check. It also stops a forged redirect from slipping in an `error=access_denied` disguised as "the user cancelled."

The keepalive and the timeout are gone. Sign-in now finishes inside `launchWebAuthFlow`, which opens and owns the window, and a cancel comes back right away, so there's no reason to stretch the service worker's lifetime.

## A Web application OAuth client

The "Chrome App" OAuth client that `getAuthToken` used doesn't work with `launchWebAuthFlow`. A Chrome App client is tied to the manifest's `oauth2` field and has no redirect URI to use. You need a new "Web application" client in Google Cloud Console with an authorized redirect URI of exactly `https://<EXTENSION_ID>.chromiumapp.org/`. That's what `chrome.identity.getRedirectURL()` returns, trailing slash included. The manifest's `oauth2` field no longer had a user, so it went.

Local development has one more catch. An unpacked extension gets a different ID from the published one unless the manifest's `key` pins it, and a different ID means a different redirect URI, which Google rejects with `redirect_uri_mismatch`. Luckily the ID was already pinned through `VITE_EXTENSION_KEY`, because the deployed webapp sends `sendMessage` to the hardcoded production ID and a local service worker has to receive it. That same pin made `getRedirectURL()` match the URI registered in Cloud Console locally, too.

## What changed

| | getAuthToken + keepalive | launchWebAuthFlow |
|---|---|---|
| Cancel detection | Callback sometimes never arrives | Rejects as soon as the window closes |
| Service worker keepalive | Ping every 20s | None |
| Timeout | 60s (5 min raced Chrome's lifetime limit) | None |
| Wait for a user who cancelled | `identity/timeout` after 60s | `auth/popup-closed-by-user` right away |
| OAuth client | Chrome App (manifest `oauth2`) | Web application (Cloud Console redirect URI) |
| State check | None (Chrome handles it internally) | Explicit, before the fragment is read |
| Lines in `signInGoogleOp` (excluding comments and blanks) | 49 | 90 |

The code grew by about 40 lines of URL building, fragment parsing and error mapping, and two timers disappeared. The migration is commit [`7b95db1`](https://github.com/zeikar/commentarium-extension/commit/7b95db1).
