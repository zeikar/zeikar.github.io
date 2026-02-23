---
layout: project
title: "Charivo"
description: "Modular Live2D + LLM framework for building interactive AI characters with pluggable voice and rendering layers."
tech_stack: ["TypeScript", "pnpm Monorepo", "Live2D", "LLM/TTS/STT", "OpenAI Realtime API"]
github_url: "https://github.com/zeikar/charivo"
demo_url: "https://charivo.vercel.app/"
image: "/assets/images/projects/charivo.png"
sequence: 1
---

## Project Overview

Charivo is a framework that abstracts the complexity of interactive character systems into composable modules. Instead of tightly coupling rendering, language, and audio, it lets developers combine components by interface contracts.

## Key Features

- **Modular Package System**: Core, LLM, TTS, STT, Realtime, and Renderer layers are independently swappable
- **Live2D Simplification**: High-level APIs reduce raw SDK setup to a few integration steps
- **Emotion-aware Interaction**: Conversation output can map to character expressions and motions
- **Voice Pipeline**: Pluggable text-to-speech and speech-to-text with browser and remote providers
- **Realtime Voice Support**: OpenAI Realtime API support via WebRTC-focused client modules
- **Framework Agnostic**: Usable from React, Vue, or vanilla environments

## Technical Challenges & Solutions

### Challenge 1: Extensibility without chaos
Adopted manager-based architecture with clear interfaces so new providers can be added without rewriting consumers.

### Challenge 2: Runtime coordination
Built event-driven orchestration to synchronize dialogue state, audio playback, and visual animation.

### Challenge 3: Production-safe integrations
Separated client and server concerns to avoid exposing sensitive provider credentials in frontend contexts.

## What I Learned

- Designing SDK-style TypeScript APIs for long-term maintainability
- Managing monorepo package boundaries and developer experience
- Coordinating multimodal systems (text, voice, and animation) in one framework
- Translating complex engine setup into pragmatic developer tooling

## Impact

Charivo makes advanced character interaction systems accessible to application developers who need production flexibility without Live2D + LLM boilerplate overhead.
