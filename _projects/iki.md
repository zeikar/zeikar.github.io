---
layout: project
title: "Iki"
description: "Open, MIT-licensed 2D puppet engine for the web, a Live2D alternative whose Claude Code plugin has an image model draw a character's parts and then rigs them over MCP."
tech_stack:
  [
    "TypeScript",
    "WebGL2",
    "MCP",
    "Claude Code plugin",
    "pnpm Monorepo",
    "React",
    "Vitest",
    "Changesets",
  ]
github_url: "https://github.com/zeikar/iki"
demo_url: "https://zeikar.dev/iki/"
image: "/assets/images/projects/iki.png"
sequence: 1
gadget_no: 17
date: 2026-06-04
---

**Iki** (息 breath · 生き life · 粋 chic) is a 2D puppet rig engine for the web, and an AI agent can build its characters: describe one, and an image model draws the parts and the auto-rigger turns them into a rigged, animated model. Art of your own works too, as separate layers. Live2D Cubism is the industry standard and [Inochi2D](https://inochi2d.com/) the established open alternative. I made Iki because I couldn't find a permissive license, a plain-text format, and a rig an agent can build in one place.

## An agent draws and rigs the character

- **What goes in:** a text description, from which the plugin generates each part, or your own transparent PNG layers named by role, or one layered PSD in the editor. `face`, `eye_L`, `eye_R` and `mouth` are required; irises, brows, lashes, nose, blush, hair, and torso are optional.
- **What comes out:** a validated `.iki` model that blinks, gazes, lip-syncs, turns, nods and tilts its head, moves its brows, and breathes, with hair swaying on physics. On a turn the nose leads, the features slide across the face, and the back hair trails behind, so it reads as a head rotating rather than a cutout sliding.
- **How an agent drives it:** the `@ikijs/mcp` server exposes `auto_rig_from_layers`, plus `compose_layers_from_parts` to place generated part images on a shared canvas and `measure_layers`, a geometry report that catches an iris the wrong size for its eye or a cropped edge before it costs another round of image generation. `measure_turn_reference` measures how far a head turns between a front and a turned reference image, so the rig's turn can be fitted to it.

The Claude Code plugin bundles the server with two skills: a single pass from a text description to a finished `.iki`, and a generator/critic loop in which an artist agent draws and re-rigs while a critic agent scores the render against a reference image until it's worth shipping. Drawing the parts needs an image generator; the prompts were tuned against Codex CLI's built-in image generation.

```
/plugin marketplace add zeikar/iki
/plugin install iki@iki
```

## What a rig is made of

That only works because the model is small and readable. A `.iki` file is one JSON document, textures included, and it's made of:

- **Parameters.** Named, ranged values like `ParamAngleX` or `ParamEyeLOpen`. A standard set of sixteen ids lets any host drive any model without wiring it up per model.
- **Parts.** Quads or triangle meshes cut from a texture atlas, moved, rotated, scaled, and faded by parameters through linear bindings.
- **Deformers.** Pivoted matrix deformers in a parent hierarchy, plus warp grids with keyforms, including 2D grids that blend a head turn with a nod.
- **Clipping masks.** Stencil-based, so an iris clipped to its eye white never spills out at extreme gaze.
- **Physics.** Spring-mass-damper rigs and multi-segment gravity chains for hair.

The validator fails fast and names the exact path, e.g. `parts[3].mesh.indices[12] 40 is out of range`, so an agent can check its own output. The WebGL2 runtime depends only on the format and knows nothing about its host, which sets parameters from lip-sync, gaze, and expressions while the engine's motion driver handles idle blinking, breathing, and physics.

## Using it

The format, engine, a headless editing core, and the MCP server are on npm under `@ikijs`. The [landing page](https://zeikar.dev/iki/) plays the generated hero live, its head and eyes following the mouse, and the [playground](https://zeikar.dev/iki/playground/) moves it with the same sliders a host would drive. The [editor](https://zeikar.dev/iki/editor/) authors parts, deformers, and physics rigs and exports a validated `.iki`. It's still early and the schema is settling; for production-grade rigging today, use Cubism.

[Charivo](/projects/charivo/) dogfoods it through a private `render-iki` adapter that its CI builds against Iki's published engine; Charivo's published renderer and demos still use Live2D.
