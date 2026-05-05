---
title: "Chrome Extension OAuth: From getAuthToken to launchWebAuthFlow"
subtitle: "Why Chrome's account chooser sometimes silently swallows your cancel callback, why the obvious band-aid races itself, and the primitive that side-steps both."
date: 2026-05-05
lang: en
translations:
  ko: /blog/ko/from-getauthtoken-to-launchwebauthflow/
description: "When chrome.identity.getAuthToken silently drops its cancel callback, the MV3 SW idle timer turns it into a 60-second spinner. A keepalive band-aid races Chrome's per-request 5-minute cap. launchWebAuthFlow is the primitive that side-steps both."
---

This is a story about cancel detection in OAuth — specifically, why we were band-aiding around `chrome.identity.getAuthToken` in a Chrome extension, why the band-aid raced itself, and how stepping back to a different `chrome.identity` primitive made the band-aid disappear.

A small problem, but the shape rhymes with the [previous CHIPS post](/blog/from-chrome-cookies-to-chips/): we tried to fix the wrong thing.

## Setup

Quick recap: [Commentarium](https://commentarium.app) is a comments app, and the [Chrome extension](https://github.com/zeikar/commentarium-extension) injects an iframe of `commentarium.app/comments?url=…` on every page. The service worker brokers Firebase auth between the iframe and the deployed webapp. The previous post was about how the *cookie* gets to the iframe; this one is about how the *Firebase ID token* is generated in the SW in the first place.

Until last week, that was a one-liner:

```ts
const { token: accessToken } = await chrome.identity.getAuthToken({ interactive: true });
const credential = GoogleAuthProvider.credential(null, accessToken);
await signInWithCredential(auth, credential);
```

Chrome's account chooser opens, the user picks an account, you get an access token, you hand it to `GoogleAuthProvider.credential` and Firebase signs them in. Done.

Until a user closes the chooser without picking anything.

## The 60-second spinner

QA report: "click *Sign in with Google*, the chooser opens, I close it, and the spinner just sits there." How long? About a minute.

A minute is a curious amount of time. Not "forever" (real hangs feel longer in user time), not "instant" (real cancellation is sub-second). Sixty seconds is a *budget* — somebody is timing something out.

The SW DevTools console finally tells us who:

```
Unchecked runtime.lastError: A listener indicated an asynchronous response by returning true,
but the message channel closed before a response was received
```

The webapp's `chrome.runtime.sendMessage(EXT_ID, { type: "signIn.google" })` was waiting on the SW for a response. The SW had returned `true` from the message handler (signaling "I'll respond async"), then sat awaiting `chrome.identity.getAuthToken`. After about a minute, Chrome force-closed the message channel because the SW had idled out. The webapp got a generic channel-closed error, surfaced as "Authentication failed."

## Why 60 seconds?

Two platform behaviors collide.

**Behavior #1**: `chrome.identity.getAuthToken({ interactive: true })`'s cancel callback behaved unreliably in our testing. On most platforms, when the user closes the chooser without selecting, Chrome calls back with `chrome.runtime.lastError = "The user did not approve access."` and the Promise rejects. In our macOS QA environment, that path dropped the callback entirely. The Promise neither resolves nor rejects. The await just hangs.

**Behavior #2**: MV3 service workers idle out. The official rule is a 30-second timer that resets on every event the SW handles. A pending message-handler response *should* keep the SW alive, but in practice the SW is torn down somewhere in the 30-to-60-second window if the work is just sitting in a hung await. When the SW dies, the message channel closes, and the webapp sees "channel closed before response."

Compose them: the cancel path doesn't fire → SW awaits forever → SW idles out → channel closes → webapp shows generic error after ~60s.

## First fix: keepalive + timeout race

The straightforward band-aid:

```ts
async function signInGoogleOp(): Promise<AuthResponse> {
  // Keep the SW alive while the OAuth flow is pending.
  const keepAlive = setInterval(() => {
    void chrome.runtime.getPlatformInfo().catch(() => {});
  }, 20_000);

  // Race against a hard cap so a stuck callback can't hang forever.
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

`chrome.runtime.getPlatformInfo()` is the cheapest `chrome.*` call we could think of — it has no side effects and pinging it every 20 seconds keeps the SW from idling out. The 5-minute timeout would surface a clean `identity/timeout` error if the cancel callback was *really* never coming.

This worked. The webapp now stops spinning after 5 minutes instead of 60 seconds.

5 minutes is, somehow, worse UX than 60 seconds.

## Racing yourself

A code reviewer caught the next problem: Chrome [terminates an extension service worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) when a single event or API request takes longer than ~5 minutes to process — independent of any `chrome.*` activity going on alongside it. Our message-handler request had been awaiting `getAuthToken` since the chooser opened; *that* was the in-flight single request, and our 5-minute timeout was racing exactly that cap. If Chrome killed the SW first, the timer never fires, the channel closes uncleanly, and we're back to the original "channel closed" error.

Drop the timeout to 60 seconds. We no longer race the cap, but the user still waits a full minute before getting a structured response. The keepalive is doing its job — keeping the SW alive — but only so it can deliver "we gave up" 60 seconds later.

That's the moment it became obvious we were patching the wrong layer. The keepalive was extending an await that *should not have been needed in the first place*. The cancel signal was sitting somewhere we couldn't see from inside `getAuthToken`.

## The right primitive

`chrome.identity` ships two interactive APIs:

| API | What it opens | Cancel signal |
|---|---|---|
| `getAuthToken` | Chrome-internal account chooser | Sometimes silently dropped |
| `launchWebAuthFlow` | A regular browser window pointed at an OAuth URL | Promise rejects when the window closes; redirect URL fragment carries `error=access_denied` if the provider denies |

`launchWebAuthFlow` opens a real Chromium window. When the user closes it via the X button, Chrome reliably fires the callback with an error. There is no internal account-chooser surface to swallow the close event.

You give up the convenience of `getAuthToken`'s "give me a token, you figure out the rest" — instead you build the OAuth URL yourself, pass it to `launchWebAuthFlow`, and parse the redirect URL fragment that comes back. Roughly 15-20 more lines of code. In exchange, the cancel path becomes ~immediate and observable.

## The migration shape

We kept the existing Firebase wiring intact. Specifically, we used `response_type=token` so the redirect carries an `access_token` we can pass to `GoogleAuthProvider.credential(null, accessToken)` — exactly what `getAuthToken` was feeding it. No nonce-verification surface to introduce.

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
  // ...Firebase block, identical to before
}
```

Three details worth highlighting.

**Cancel mapping to `auth/popup-closed-by-user`.** That's Firebase's standard error code for popup-based OAuth cancellation. The webapp already had a code path for it — it's what `signInWithPopup` produces in browser flows — so the user-visible "Sign-in cancelled" copy was free. No webapp change needed.

**State verified first.** Both success and error responses echo back `state`. Verifying it before reading any other fragment field gates everything downstream on a CSRF check. A maliciously crafted redirect can't smuggle an `error=access_denied` past us as a "user cancelled" signal.

**No keepalive, no timeout race.** Both went away. The OAuth flow now resolves or rejects inside `launchWebAuthFlow`, the API that owns the prompt, so we no longer need a separate SW keepalive or a custom timeout to work around lifetime limits.

## The Cloud Console caveat

You can't reuse a "Chrome App"-type OAuth client_id with `launchWebAuthFlow`. Chrome App clients are tied to the manifest's `oauth2` field and don't accept arbitrary redirect URIs. You need a "Web application" client_id with an authorized redirect URI of exactly `https://<EXTENSION_ID>.chromiumapp.org/` — trailing slash matters, that's what `chrome.identity.getRedirectURL()` returns. The extension's old `oauth2` manifest field becomes dead and gets removed.

(There's a separate concern in unpacked-dev workflows: a dev's local extension ID won't match the prod ID unless they pin it via the manifest's `key` field. Pinning via `VITE_EXTENSION_KEY` was already required so the deployed webapp's hardcoded prod-EXT_ID `runtime.sendMessage` call could reach a local SW. After this migration, pinning also makes `getRedirectURL()` return the URI Cloud Console has authorized. One stone, two birds.)

## What the diff looked like

| | getAuthToken path | launchWebAuthFlow path |
|---|---|---|
| Cancel detection | Silently dropped on some platforms | Promise rejects within ~1s |
| SW keepalive ping | Required (every 20s) | None |
| Timeout | Required (first 5 min, racing the SW lifetime cap; then 60s) | None |
| User wait on cancel | ~60s before generic error | ~1s, structured `auth/popup-closed-by-user` |
| OAuth client type | Chrome App (manifest `oauth2`) | Web application (Cloud Console redirect URI) |
| State / CSRF defense | None (Chrome handles it internally) | Explicit, verified before fragment is consumed |
| Lines in `signInGoogleOp` | ~30 (band-aided) | ~50 (URL build + fragment parse + error mapping) |

15-20 more lines of code. Two timer-juggling primitives gone. A 60× UX improvement on the cancel path.

## Takeaways

1. **Platform-quirk band-aids race other platform quirks.** The keepalive + timeout was racing the very SW lifetime cap that we were keeping alive against. Patching at the wrong layer means trading one platform constraint for another.
2. **"Right primitive" beats "right workaround."** Once we noticed `launchWebAuthFlow` had a deterministic cancel signal, the `getAuthToken` band-aid looked dated. Thirty lines of timer juggling was mass-and-energy in the wrong place.
3. **Verify `state` before reading any other OAuth response field.** Both success and error redirects echo it. Checking it first is a free CSRF defense and rules out a category of weird "I cancelled but the app says I tried something else" reports.
4. **MV3 SW lifetime is a structural constraint, not a tweakable.** Treat the 30-second idle timer and ~5-minute per-request cap as architecture inputs. If your design needs a single request to take longer than 5 minutes, you're probably in the wrong shape — like we were.

The fix once we found it was, again, surprisingly mechanical. The hardest part was admitting the band-aid wasn't *almost* working.

---

*Code: [commentarium-extension](https://github.com/zeikar/commentarium-extension). The migration landed as commit [`7b95db1`](https://github.com/zeikar/commentarium-extension/commit/7b95db1).*
