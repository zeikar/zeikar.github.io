---
layout: project
title: "Charaloom"
description: "AI character creation and streaming chat platform with multilingual UX, Firebase auth, and creator-friendly sharing."
tech_stack: ["Next.js 16", "React 19", "TypeScript", "Firebase", "OpenAI AI SDK"]
demo_url: "https://charaloom.vercel.app"
image: "/assets/images/projects/charaloom.png"
sequence: 8
gadget_no: 10
---

Charaloom is a full app for making AI characters and chatting with them: create a character, give it a persona, and talk to it in a streaming chat — plus the supporting cast a real product needs (accounts, credits, a community board, discovery).

## What's in it

- **Character CRUD + discovery** — create, edit, and delete characters, browse a preset list with infinite scroll, and like the ones you want
- **Streaming chat** — per-character chat rooms backed by the Vercel AI SDK + OpenAI, with history you can review or clear
- **Credits** — a signup bonus, per-chat consumption, and a usage ledger, with admin scripts to adjust balances or seed characters
- **Accounts** — Google and anonymous sign-in, anonymous→Google upgrade, profile editing, and account deletion
- **Community board** — posts and comments, plus tag search with autocomplete
- **Built for two languages** — `en`/`ko` routing via next-intl, with a dynamic sitemap, robots, and a PWA manifest for SEO

## Under the hood

State is split on purpose: TanStack Query owns server state (characters, feeds, chat history), Zustand holds local UI state, and Zod validates anything crossing the wire. Auth, Firestore, and Storage all go through Firebase, with the Admin SDK on server routes so user-scoped writes stay locked down. Built on Next.js (App Router) + React 19, tested with Vitest and React Testing Library.
