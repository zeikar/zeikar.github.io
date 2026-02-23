---
layout: project
title: "Charaloom"
description: "AI character creation and streaming chat platform with multilingual UX, Firebase auth, and creator-friendly sharing."
tech_stack: ["Next.js 16", "React 19", "TypeScript", "Firebase", "OpenAI AI SDK"]
demo_url: "https://charaloom.vercel.app"
image: "/assets/images/projects/charaloom.png"
sequence: 5
---

## Project Overview

Charaloom is a full-stack AI character platform where users can create characters, manage profiles, and chat in real time. It combines content creation, social discovery, and conversational AI into one product experience.

## Key Features

- **Character CRUD**: Create, edit, and manage personalized AI characters
- **Streaming Chat**: Low-latency chat flow with OpenAI SDK streaming responses
- **Auth System**: Google sign-in, anonymous sign-in, and account upgrade support
- **Content Discovery**: Preset lists and infinite-scroll browsing for character exploration
- **Multilingual Routing**: Localized UX with `en` and `ko` routes using `next-intl`
- **Profile Management**: User profile updates, account controls, and privacy-aware flows

## Technical Challenges & Solutions

### Challenge 1: Reliable state boundaries
Used TanStack Query for server state and Zustand for local UI state to keep chat, feed, and form workflows predictable.

### Challenge 2: End-to-end chat architecture
Structured API and backend layers to keep persona context, history handling, and streaming output maintainable over time.

### Challenge 3: Auth and data integration
Integrated Firebase Auth, Firestore, and Storage with API routes to support secure, user-scoped content operations.

## What I Learned

- Applying app-router patterns to a complex product surface
- Designing AI UX that balances speed, control, and personality consistency
- Building testable frontend/domain logic with Vitest and React Testing Library
- Shipping multilingual interfaces without fragmenting core product logic

## Impact

Charaloom turns character ideation into an interactive social product, enabling creators to move from concept to conversation in minutes.
