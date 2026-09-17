---
layout: project
title: "Iki"
description: "MIT-licensed 2D rig engine for the web, with an MCP server and a Claude Code plugin that let an AI agent rig a character from layered art."
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
---

**Iki** (息 breath · 生き life · 粋 chic) is a 2D puppet rig engine for the web, and an AI agent can build its rigs: give it a character's art as separate layers and a rigged, animated model comes back. Live2D Cubism is the industry standard and [Inochi2D](https://inochi2d.com/) the established open alternative. I made Iki because I couldn't find a permissive license, a plain-text format, and a rig an agent can build in one place.

## An agent does the rigging

- **What goes in:** transparent PNG layers named by role, or one layered PSD in the editor. `face`, `eye_L`, `eye_R` and `mouth` are required; irises, brows, lashes, nose, hair, and body are optional.
- **What comes out:** a validated `.iki` model that blinks, gazes, lip-syncs, turns, nods and tilts its head, and moves its brows, with hair swaying on physics. On a turn the nose leads, the features slide across the face, and the back hair trails behind, so it reads as a head rotating rather than a cutout sliding.
- **How an agent drives it:** the `@ikijs/mcp` server exposes `auto_rig_from_layers`, plus `compose_layers_from_parts` to place generated part images on a shared canvas and `measure_layers`, a geometry report that catches an iris the wrong size for its eye or a cropped edge before it costs another round of image generation.

The Claude Code plugin bundles the server with two skills: a single pass from a text description to a finished `.iki`, and a generator/critic loop in which an artist agent draws and re-rigs while a critic agent scores the render against a reference image until it's worth shipping.

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

The format, engine, a headless editing core, and the MCP server are on npm under `@ikijs`. The [playground](https://zeikar.dev/iki/playground/) moves a generated character with the same sliders a host would drive. The [editor](https://zeikar.dev/iki/editor/) authors parts, deformers, and physics rigs and exports a validated `.iki`. It's still early and the schema is settling; for production-grade rigging today, use Cubism.

[Charivo](/projects/charivo/) dogfoods it through a private `render-iki` adapter that its CI builds against Iki's published engine; Charivo's published renderer and demos still use Live2D.
