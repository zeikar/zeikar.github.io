---
layout: project
title: "Commentarium"
description: "Chrome extension that adds a social layer to any page with ratings, comments, and community voting."
tech_stack: ["Chrome Extension", "Next.js", "React", "TypeScript", "Firebase"]
github_url: "https://github.com/zeikar/commentarium-extension"
demo_url: "https://commentarium.app"
image: "/assets/images/projects/commentarium.png"
sequence: 5
gadget_no: 5
---

Commentarium is a Chrome extension that adds a social layer — ratings, comments, and votes — to any page on the web. It injects a side panel that talks to a Next.js + Firebase backend holding the comments, the auth, and the API. Install it from the [Chrome Web Store](https://chromewebstore.google.com/detail/hogjejflnephnomijedgfocipidnkemf).

## What it does

- **Comments and ratings on any URL** — Markdown editor, threaded replies, soft delete
- **Votes that stay consistent** — up/down votes run transactionally, and casting the opposite vote auto-cancels the previous one
- **Nine ways to sort** — Best, Trending, Recent Activity, Newest, Oldest, Most Upvotes, Most Downvotes, Controversial, and Random. The Best, Trending, and Recent Activity scores are denormalized into a `sortMeta` field and refreshed after each write, not recomputed on every read
- **Anonymous or Google sign-in** — anonymous accounts upgrade to Google *without losing their UID*, so a user's history survives the upgrade
- **A privacy guard** — before a URL is shown, an entropy check flags token-like path segments (session tokens, signed links) so private URLs don't leak into a public feed

## The hard part: auth inside a third-party iframe

The side panel is `commentarium.app` content rendered in an iframe on arbitrary sites — a textbook third-party context, where browsers block the session cookie. Making sign-in work there without `chrome.cookies` or host permissions turned into its own redesign around CHIPS partitioned cookies. I wrote it up: [From chrome.cookies to CHIPS](/blog/from-chrome-cookies-to-chips/).

Google sign-in in the service worker had a trap of its own: `chrome.identity.getAuthToken` can silently drop its cancel callback, which left a minute-long spinner, and the obvious keepalive fix raced Chrome's five-minute cap on each request. Switching to `launchWebAuthFlow` removed both problems: [From getAuthToken to launchWebAuthFlow](/blog/from-getauthtoken-to-launchwebauthflow/).
