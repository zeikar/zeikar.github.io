---
layout: project
title: "LiveClaw"
description: "Desktop AI companion built on Electron with Live2D avatars, OpenClaw-based chat, and integrated speech synthesis."
tech_stack: ["Electron", "React 19", "TypeScript", "Charivo", "OpenClaw"]
github_url: "https://github.com/zeikar/liveclaw"
image: "/assets/images/projects/liveclaw.png"
sequence: 2
---

## Project Overview

LiveClaw is a desktop AI companion that brings Live2D avatars and local-first chat workflows into a single Electron app. It integrates Charivo for character orchestration and OpenClaw as the local LLM backend.

## Key Features

- **Desktop-first UX**: Native-packaged experience for macOS, Windows, and Linux
- **Live2D Character Rendering**: Avatar motion and expression playback via Charivo renderer stack
- **Local LLM Integration**: OpenClaw provider in Electron main process for stable local chat calls
- **Voice Output**: OpenAI TTS playback for spoken assistant responses
- **IPC-based Architecture**: Clear boundary between renderer UI and backend provider operations
- **Roadmap-ready Foundation**: Structured for upcoming STT and streaming improvements

## Technical Challenges & Solutions

### Challenge 1: Cross-process orchestration
Used IPC boundaries to bridge renderer interactions with provider logic in the Electron main process.

### Challenge 2: Realtime character feedback
Connected chat events to character rendering layers to keep text output and avatar behavior in sync.

### Challenge 3: Practical local security
Balanced local development speed with key-handling constraints and clear environment-based configuration.

## What I Learned

- Packaging AI-enabled apps for desktop targets with Electron tooling
- Structuring hybrid UI + local-provider systems without coupling
- Applying Charivo modules inside a production desktop architecture
- Managing tradeoffs between local convenience and secure key usage

## Impact

LiveClaw is a concrete bridge from reusable framework modules to a user-facing desktop product, validating Charivo in a real application context.
