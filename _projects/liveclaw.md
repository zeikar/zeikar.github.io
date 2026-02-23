---
layout: project
title: "LiveClaw"
description: "OpenClaw-powered desktop companion with Live2D avatars, voice input/output, and a practical Electron architecture."
tech_stack: ["Electron", "React 19", "TypeScript", "Charivo", "OpenClaw"]
github_url: "https://github.com/zeikar/liveclaw"
image: "/assets/images/projects/liveclaw.png"
sequence: 2
---

## Project Overview

LiveClaw is an OpenClaw-powered desktop companion currently in active development. It combines Live2D characters, local-first chat, and speech features in a single Electron app built with React and TypeScript.

## Key Features

- **Electron Desktop Shell**: Native packaging targets for macOS, Windows, and Linux
- **Live2D Integration**: Avatar rendering and motion playback via `@charivo/render-live2d`
- **OpenClaw Chat Backend**: OpenAI-compatible local LLM calls routed through the main process
- **Direct TTS Playback**: Renderer-side OpenAI TTS for quick local voice output
- **Clear Process Boundary**: Renderer UI and provider calls are separated through IPC
- **WIP Roadmap**: Foundation prepared for STT and streaming upgrades

## Architecture Notes

- **Renderer Layer**: React UI + Charivo orchestration + Live2D panel
- **Main Process Layer**: OpenClaw provider and Node-side API calls
- **Provider Access Pattern**: Chat via IPC to avoid renderer CORS/PNA issues
- **TTS Path**: Direct renderer API usage for local development convenience

## Technical Challenges & Solutions

### Challenge 1: Cross-process coordination
Chat events, rendering lifecycle, and provider calls were split cleanly between renderer and main process responsibilities.

### Challenge 2: Character synchronization
Live2D state and conversation flow were wired through Charivo so motion/response behavior stays coherent.

### Challenge 3: Local-dev practicality vs security
Direct renderer-side TTS improves local iteration speed, but requires explicit key-handling cautions for trusted environments.

## What I Learned

- Desktop packaging and runtime workflows with Electron + electron-vite
- Hybrid architecture patterns for renderer/main process separation
- Applying framework modules (`Charivo`) in a real desktop product
- Making pragmatic tradeoffs while keeping a path to production hardening

## Impact

LiveClaw validates a practical path from reusable character framework modules to a user-facing desktop companion product.
