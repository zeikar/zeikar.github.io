---
layout: project
title: "Whozzie"
description: "Random decision app with a name wheel and dice roller for quick, fair picks in both Korean and English."
tech_stack: ["Next.js 16", "React 19", "TypeScript", "next-intl", "Tailwind CSS 4"]
github_url: "https://github.com/zeikar/whozzie"
demo_url: "https://whozzie.vercel.app"
image: "/assets/images/projects/whozzie.png"
sequence: 9
---

## Project Overview

Whozzie is a lightweight decision-making web app built for everyday moments when you need a fair random choice. It provides two core tools: a wheel-based picker for names/items and a multi-dice roller.

## Key Features

- **Wheel Picker**: Add names or items and spin to select a random result
- **Dice Roller**: Roll multiple dice types (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`) with history tracking
- **Multilingual UX**: Localized experience in English and Korean
- **Fast, Simple Flow**: Minimal input friction for quick team/class/group use cases
- **Responsive Interface**: Optimized for desktop and mobile use

## Technical Challenges & Solutions

### Challenge 1: Clean random interactions
Built UI flows where input, randomization, and result feedback remain clear and predictable even with repeated spins/rolls.

### Challenge 2: Internationalization coverage
Used `next-intl`-based locale routing and message separation to keep translations maintainable as features expand.

### Challenge 3: SEO and routing consistency
Configured localized sitemap/robots behavior and route structure so pages are crawlable while preserving i18n URLs.

## What I Learned

- Designing fun utility products with low cognitive load
- Structuring i18n-ready UI early in the project lifecycle
- Balancing playful interaction with deterministic app behavior
- Shipping compact tools that still feel polished

## Impact

Whozzie turns common “who goes first?” moments into a fast and enjoyable interaction that works across language contexts.
