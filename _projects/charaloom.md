---
layout: project
title: "Charaloom"
description: "AI character platform: build characters and worlds, chat one-on-one or in groups, and play branching stories, in English and Korean."
tech_stack: ["Next.js 16", "Vercel AI SDK", "OpenAI", "Firebase", "React 19", "TypeScript", "next-intl", "TanStack Query"]
demo_url: "https://charaloom.vercel.app"
image: "/assets/images/projects/charaloom.png"
sequence: 8
gadget_no: 10
---

Charaloom is a web app for writing AI characters and then spending time with them. You give a character a persona and a greeting, then talk to it, put it in a room with other characters, or start a story with it. Around that sit the parts a real product needs: accounts, credits, a community, and ways to find other people's characters.

## Characters live in a shared setting

- **Characters** can be private or public, tagged (with tag suggestions as you type), liked, and gathered into public or private collections.
- **Relationships** between characters are written out explicitly, and they carry into the conversations those characters share.
- **Worlds** are settings of their own. A character joins a world by request, and the world's owner approves or rejects the link. Once approved, the world comes along into that character's stories.

## Conversations that branch

- **One-on-one chat** streams replies. Editing a message or regenerating a reply doesn't overwrite anything: the old version stays as a branch you can switch back to.
- **Group chat** holds two to five characters in one room. On each turn the app picks which of them answer, up to three, and they reply one after another.
- **Stories** are turn-based interactive fiction seeded by a character or a world, with the same branching as chat. A style preset (immersive, cinematic, lyrical, light novel, dialogue-forward) or a short prompt of your own sets the prose style.

A story can be published to a public gallery, and a chat can be shared as a read-only link. Both keep the same link when republished and stop working once revoked.

## Everything around it

- **Community.** A board with announcements and community posts, per language. Comments on characters, worlds, published stories, shared chats, and posts. You can follow creators and get notified when they publish or when someone comments on your work.
- **Credits.** A signup bonus and a daily login bonus, spent per chat and story turn, with a history of every change.
- **Accounts.** Google or anonymous sign-in. An anonymous account can be upgraded to Google later.
- **Two languages.** English and Korean routes throughout, with a dynamic sitemap and a PWA manifest.

It's built on Next.js (App Router) with Firebase for auth, data, and storage, and the Vercel AI SDK streaming OpenAI models.
