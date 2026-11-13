---
layout: project
title: "Elsewhere"
description: "Autopilot space travel in the browser. Stars stream past, and now and then a procedurally generated planet, nebula, asteroid or comet drifts by. No missions, no destination, just the journey."
tagline: "Ambient Space Travel Screensaver in the Browser"
tech_stack: ["Three.js", "TypeScript", "WebGL", "GLSL", "Vite", "Playwright"]
github_url: "https://github.com/zeikar/elsewhere"
demo_url: "https://zeikar.dev/elsewhere/"
image: "/assets/images/projects/elsewhere.png"
gadget_no: 31
date: 2026-11-04
---

Elsewhere is a screensaver you leave running in a browser tab. The ship flies itself from the first frame: white stars rush past in warp, and about every 40 seconds it drops out of warp for an encounter. A seeded planet, asteroid or comet grows from a dot, or a nebula slowly brightens; either way it passes alongside and falls behind. The controls and cursor hide after a few seconds, and a Screen Wake Lock keeps the display on where the browser supports it. Each load is a new trip whose seed lands in the URL, so a copied link replays the same planets in the same order.

It is also the project I pointed [Octoperator](/projects/octoperator/) at. I gave it my plan document; it split the plan into issues with acceptance criteria, and what I noticed while watching became more issues. Getting from an empty repo to the finished MVP, plus the fixes from trying it, took 35 merged pull requests over about 48 hours, each one carrying its own posted review.

## Path first, planet second

An encounter doesn't place a planet and then steer around it. The autopilot plans the path first, then puts the object beside it at a pass distance drawn from the seed, so the closest approach is known the moment the encounter begins and the ship never flies through a planet, a ring, a rock, a comet's tails or a nebula's bright core. The slowdown and the fade-out follow the distance left to the closest approach. While the object is still a dot under 3° across, the ship keeps going fast; then it eases down to encounter speed, passes, and climbs back into warp as soon as the object has left the actual screen, so a narrow window and a wide one leave at slightly different moments.

Every planet comes from a seed: rocky worlds from palette families like terran, desert and volcanic, gas giants with turbulent bands and often an oval storm, and the odd Pluto-like icy dwarf. About one planet in six wears a banded ring that the planet shadows. Comets get a straight ion tail and a curved dust tail pointing away from their sun, and the ship slows early enough that the tails never sweep past quickly.

## A sky that holds still

The sky is two layers of instanced quads. 4,000 far stars sit at infinity: their shader uses only the rotation of the view, with no ship position at all, so travel can't move them. In front, 8,000 motes of dust wrap around the camera and stretch into streaks whose length follows the speed. The camera stays at the origin and the ship's position lives on the CPU in float64, so nothing jitters however long the trip runs.

The ship used to drift its heading slowly, up to about 0.9° a second. That turned the camera, and the "fixed" far stars and galaxies turned with it. The fix was to remove the drift entirely and fly one heading, which made the backdrop perfectly still.

## The fan got loud

Watching it on a MacBook, the fan spun up whenever a planet came close. The surface was fully procedural, about 13 gradient-noise evaluations and 54 hashes per pixel, at 2× DPR, on a 120 Hz display, every frame, for a surface that barely changes. The fix started by measuring: a GPU timer on `EXT_disjoint_timer_query_webgl2`, an on-screen overlay, and an estimate for browsers without the extension. Then it baked each planet's surface once into 1024² cube maps, spread over the frames while the planet is still a dot, so the per-frame shader only samples and lights it, and drew the atmosphere only past the planet's edge instead of over the whole disc. Measured under SwiftShader at 3024×1964 (a software renderer, useful only for comparisons), an ocean world's closest-approach frame went from 4.0× a cruise frame to 1.83×, and an all-land world's to 2.77×. A 60 fps cap means a 120 Hz display pays that cost half as often. Nebulae are still the most expensive thing on screen.

## Tests that hold it to the plan

Each item of the plan's verification checklist is mapped to a test or, where only a real device can tell, a manual step, and a unit test fails if a file or test title that map cites goes missing. A soak test travels through encounter after encounter and fails if the heap after a forced GC grows, late frames get slower than early ones, or the renderer's resource counts drift; CI runs five minutes of it on every change. The e2e build adds URL flags to force an encounter kind or shorten the interval, and a production check makes sure none of that hook ships.
