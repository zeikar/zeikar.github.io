---
layout: project
title: "Next.js Firebase Boilerplate"
description: "A Next.js + Firebase starter where the server does the Firebase work: session cookies verified by the Admin SDK, and per-user Firestore data."
tech_stack: ["Next.js", "Firebase Admin SDK", "Firebase Auth", "Firestore", "TypeScript", "Vitest", "Tailwind CSS"]
github_url: "https://github.com/zeikar/nextjs-firebase-boilerplate"
demo_url: "https://nextjs-firebase-starter.vercel.app/"
image: "/assets/images/projects/nextjs-firebase-boilerplate.png"
sequence: 10
gadget_no: 7
---

The auth flows come already built: Google and anonymous sign-in, anonymous-to-Google upgrade, account deletion, and a small per-user notes demo. Most Next.js + Firebase starters authenticate in the browser. This one keeps the Admin credentials and the checks on the server.

## The server does the Firebase work

Sign-in starts in the Firebase client SDK, but the ID token is exchanged once for a two-week `httpOnly` session cookie. Server components and route handlers verify that cookie with the Admin SDK, and the page reads the current user on the server.

Firestore follows the same line. Notes live at `users/{uid}/notes`, read by a server component and written through a route handler, and the uid always comes from the verified cookie, never from the request. The client never imports `firebase/firestore`, and `firestore.rules` denies every client read and write. The Admin SDK bypasses rules, so they only start to matter if client-side access is ever added.

A Firestore read that fails with a transient error, such as the service being unavailable, replaces only the notes panel with an "unavailable" line. Anything else, like a database that was never created, fails the whole page, so a setup mistake can't hide.

## Session hardening

The auth routes assume a hostile caller:

- **Same-origin only.** State-changing routes reject a foreign `Origin`, and those that take a body also require a JSON content type, which blocks a cross-site form posting `text/plain`.
- **Fresh sign-ins only.** A new session cookie needs a sign-in from the last five minutes, unless the browser already holds that user's session, so a leaked ID token can't be traded for a two-week session.
- **Sign-out ends every session.** Firebase can't revoke a single session cookie, so sign-out revokes the user's refresh tokens, and a copied cookie stops working.
- **Deletion re-authenticates.** Deleting through the Admin SDK skips Firebase's recent-login check, so deletion also needs a freshly minted ID token. It then removes the user's notes and reports it if that fails.

Vitest covers the route handlers with the Admin SDK mocked, and the hooks and components under jsdom. CI runs lint, the tests, and a production build with a throwaway key, so forks build without secrets.

## The credential trap

Both Firebase configs go into environment variables as JSON on a single physical line. That doesn't mean deleting every `\n`: the `\n` escapes inside `private_key` are part of the key and have to survive. `jq -c` on the downloaded key file produces the right shape.
