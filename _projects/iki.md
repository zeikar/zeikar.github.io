---
layout: project
title: "Iki"
description: "Open MIT-licensed 2D rig puppet animation engine for the web — a from-scratch Live2D alternative whose format an AI agent can rig from layered art."
tech_stack:
  [
    "TypeScript",
    "WebGL2",
    "pnpm Monorepo",
    "React",
    "Vitest",
    "MCP",
    "Changesets",
  ]
github_url: "https://github.com/zeikar/iki"
demo_url: "https://zeikar.dev/iki/"
image: "/assets/images/projects/iki.png"
sequence: 17
gadget_no: 17
---

## Project Overview

**Iki** (息 breath · 生き life · 粋 chic) is a 2D rig puppet animation engine
for the web — the kind of rig that makes a drawn character blink, look around,
talk, and turn its head. Live2D Cubism owns this space and
[Inochi2D](https://inochi2d.com/) is the established open alternative; Iki
exists because three things it wanted never lined up in one place: a format you
own, a web-first runtime with no native toolchain, and rigging an AI agent can
actually drive.

It is the render layer [Charivo](/charivo/) consumes, built so that swapping
the Live2D SDK out is a matter of changing an adapter.

## How it's put together

Four packages in a strictly layered monorepo, published to npm under `@ikijs`:

- **`@ikijs/format`** — the `.iki` schema, types, loader, and a fail-fast
  validator that reports the exact path that failed. Single source of truth for
  the model contract.
- **`@ikijs/engine`** — the WebGL2 runtime. Parameter-driven color quads,
  atlas-sampled texture parts, warp-mesh and grid deformation, stencil clipping
  masks, and spring and chain physics. It depends only on the format package
  and knows nothing about any host.
- **`@ikijs/editor`** — headless editing core: documents, invertible commands,
  undo/redo, atlas layout, and the auto-rigger. No UI.
- **`@ikijs/mcp`** — an MCP server that exposes reading, validating, and
  rigging to AI agents.

## A rig is a small set of numbers

The whole point of the format is that it is legible. A posed frame is sixteen
named parameters — `ParamAngleX`, `ParamEyeLOpen`, `ParamHairSwayX` — in a
plain JSON file you can open in a text editor, diff in git, and generate from a
script. A host drives those same ids from lip-sync RMS, gaze, blink timers, and
expressions.

That legibility is what makes the interesting part possible.

## The part it is really exploring

Rigging a character is the expensive, manual step in this whole field, and it
is the step Live2D gives an agent no way into. Because `.iki` is open and
small, Iki closes that loop: role-named PNG or PSD layers go in, and a rigged
model that blinks, gazes, opens its mouth, turns its head, and emotes with its
brows comes out — through an MCP tool an agent calls directly, or a Claude
skill that chains image generation, layer composition, and rigging into one
gesture.

## Status

Early, but real, and MIT throughout — runtime, format, editor core, generator,
MCP server. No publication license, no revenue tiers, no per-title fee. If you
need production-grade 2D rigging today, use Cubism; if you want an open web
format you can script against, that is what this is.

The [playground](https://zeikar.dev/iki/playground/) drives a generated
character with the same parameters a host would, and the
[editor](https://zeikar.dev/iki/editor/) authors parts, deformers, and physics
rigs in the browser.
