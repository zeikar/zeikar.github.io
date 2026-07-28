---
layout: project
title: "Next.js Firebase Boilerplate"
description: "Production-ready starter for Next.js + Firebase with server-side auth, TypeScript, and reusable app scaffolding."
tech_stack: ["Next.js 16", "React 19", "TypeScript", "Firebase Auth", "Tailwind CSS 4"]
github_url: "https://github.com/zeikar/nextjs-firebase-boilerplate"
demo_url: "https://nextjs-firebase-starter.vercel.app/"
image: "/assets/images/projects/nextjs-firebase-boilerplate.png"
sequence: 10
gadget_no: 7
---

A Next.js + Firebase starter that ships the part everyone re-implements from scratch: real server-side authentication. The point is to skip straight to building features instead of re-wiring Firebase auth on every new project.

## What you get on day one

- **Server-side auth** — sessions verified with the Firebase Admin SDK, not just client-side checks
- **The full account lifecycle** — Google and anonymous sign-in, anonymous→Google upgrade, and account deletion
- **The boring-but-needed bits** — a notification system, an auth modal, reusable components, SEO defaults, and a Vercel-ready deploy
- **Type-safe throughout** — TypeScript + Tailwind, structured so you extend it rather than fight it

The trickiest thing it documents isn't code — it's the Firebase env setup. The Admin and Web SDK configs have to be supplied as single-line JSON with the `private_key` newlines escaped, which is exactly the kind of silent-failure trap that eats an afternoon. The starter spells it out so you don't rediscover it the hard way.
