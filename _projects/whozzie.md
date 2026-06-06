---
layout: project
title: "Whozzie"
description: "Random decision app with a name wheel and dice roller for quick, fair picks in both Korean and English."
tech_stack: ["Next.js 16", "React 19", "TypeScript", "next-intl", "Tailwind CSS 4"]
github_url: "https://github.com/zeikar/whozzie"
demo_url: "https://whozzie.vercel.app"
image: "/assets/images/projects/whozzie.png"
sequence: 13
---

Whozzie settles "who goes first?" arguments. Two tools, no setup: a spin-the-wheel picker for names or items, and a multi-die roller — for when a coin flip isn't enough.

## What it does

- **Wheel picker** — type in names or options and spin for a fair random pick
- **Dice roller** — roll `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, with a running history of rolls
- **Bilingual** — full English and Korean UI via next-intl locale routing
- **Responsive** — built for a phone passed around a table as much as a desktop

It's intentionally small — a polished single-purpose utility rather than a feature pile. The one constraint I cared about was wiring i18n in from the start, so adding a language later doesn't mean untangling hardcoded strings.
