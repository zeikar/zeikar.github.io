---
layout: project
title: "Cimulity"
description: "Browser city-sim built on a strict one-way data flow: input → tools → engine → core → render, with React reduced to a shell."
tech_stack: ["Next.js 16", "React 19", "TypeScript (strict)", "PixiJS 8", "Vitest", "Tailwind CSS 4"]
github_url: "https://github.com/zeikar/cimulity"
sequence: 3
---

## Project Overview

Cimulity is an open-source, minimal SimCity-style city-builder running entirely in the browser. The interesting part isn't the game yet — it's the architecture: a layered codebase where tools are pure, core is the only mutator, and React is intentionally demoted to a thin display shell over a PixiJS canvas.

## Key Features

- **Isometric world**: 64×64 diamond grid with WebGL rendering through PixiJS 8
- **Camera**: edge-pan that scales speed with cursor proximity to the screen edge, wheel zoom that zooms around the cursor (not the center)
- **Tools**: road painting (click or drag), R/C/I zoning (rectangle drag), bulldoze (regrowing scar), each implemented as a pure path/command builder
- **Simulation tick**: fixed-timestep loop with toolbar pause and 1×/2×/3× speed controls wired end-to-end through `GameSession`
- **Persistence**: process-wide `World` singleton survives Next.js HMR/Fast Refresh; autosave to localStorage with a "New City" reset
- **Test gate**: 80% line/branch coverage threshold scoped deliberately to the pure-logic files (core state, RoadTool, ToolActions, CommandDispatcher, IsoTransform)

## Technical Challenges & Solutions

### Challenge 1: Keeping React out of the hot path
React closures plus a long-lived Pixi canvas is a recipe for stale-prop bugs and double-init under StrictMode. `GameSession` is a plain composition root that wires Pixi + input + dispatch; React only holds mount/unmount and display state, and passes stable forwarder callbacks. PixiApp init is idempotent and guarded so HMR cycles don't leak GPU resources.

### Challenge 2: Single mutation route
The codebase enforces a one-way flow: `input` (raw drag endpoints) → `tools` (pure command builders) → `engine` (dispatch) → `core` (the only place state mutates) → `render`. Tools never reach into `World`/`Map`; the only place tool output meets core is `applyCommands` in `CommandDispatcher`. Clicks and drags share that one path — no parallel mutation route.

### Challenge 3: Tile picking and zoom around the cursor
Screen → world → tile uses a diamond-isometric inverse transform; wheel zoom adjusts camera position so the world point under the cursor stays fixed across zoom changes. Pan is clamped to map bounds, zoom to 0.25×–2×.

### Challenge 4: Coverage that means something
A blanket 80% gate would have rewarded testing Pixi glue with brittle mocks. Instead the threshold is scoped in `vitest.config.ts` to the pure-logic surface (core state, tools, dispatcher, iso transform); render glue, DOM input, and `GameSession` are intentionally excluded and verified manually.

## What I Learned

- Designing a layered codebase where the boundary is enforced by what each layer can *import*, not by convention
- Living with PixiJS 8 inside a React 19 / Next.js App Router shell without letting React drive the render loop
- Picking a coverage target that pressures the right code instead of inflating a number
- Letting a singleton be a singleton when it makes HMR survivable, instead of dressing it up as a hook

## Impact

A learning project, but a deliberate one: a small playground for testing how far the *input → tools → engine → core → render* discipline holds up as features land, and a base I can extend toward citizens, resources, and services without rewriting the spine.
