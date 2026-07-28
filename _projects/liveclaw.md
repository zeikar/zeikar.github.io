---
layout: project
title: "LiveClaw"
description: "OpenClaw-powered desktop companion with Live2D avatars, voice input/output, and a practical Electron architecture."
tech_stack: ["Electron", "React 19", "TypeScript", "Charivo", "OpenClaw"]
github_url: "https://github.com/zeikar/liveclaw"
image: "/assets/images/projects/liveclaw.png"
sequence: 7
gadget_no: 14
---

LiveClaw is a desktop companion — a Live2D character you can talk to — built as an Electron app on top of my own [Charivo](/projects/charivo/) framework. It's a work in progress, and as much as anything it's a test of whether the framework holds up in a real product.

## The shape of it

Charivo orchestrates the character in the React renderer (`useCharivo` + a `Live2DPanel`), but *where* the provider calls happen is the interesting decision:

- **Chat runs in the main process.** The renderer sends messages over IPC to Electron's Node side, which calls [OpenClaw](https://openclaw.ai/) — a local, OpenAI-compatible LLM at `localhost:18789`. Routing it through the main process sidesteps the renderer's CORS / Private Network Access limits.
- **TTS runs in the renderer.** OpenAI's audio API is called directly from the browser side — a deliberate shortcut for local-dev convenience, with the obvious caveat that the key sits in the renderer.

So the build doubles as a forcing function for Charivo: if attaching a renderer, an LLM provider, and a TTS player to a real Electron app turns out to be awkward, that's a framework bug to fix upstream.
