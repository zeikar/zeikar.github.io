---
layout: project
title: "Cimulity"
description: "A SimCity-style city builder for the browser, where workers are matched to jobs over the road network and their commutes become traffic."
tagline: "SimCity-Style Browser City Builder"
tech_stack: ["PixiJS", "TypeScript", "Next.js", "React", "Vitest"]
github_url: "https://github.com/zeikar/cimulity"
demo_url: "https://zeikar.dev/cimulity/"
image: "/assets/images/projects/cimulity.png"
gadget_no: 13
date: 2026-01-07
---

**Cimulity** is an open-source, MIT-licensed SimCity-style city builder that runs in the browser, written in TypeScript on PixiJS and Next.js. You lay roads, zone land as residential, commercial or industrial, and place power plants, water towers, police and fire stations, hospitals, schools and parks on a 64×64 isometric map. The simulation decides what gets built. The ground is a generated heightmap you can raise, lower and flatten, and anything at or below sea level is water. It's an open-ended sandbox with no win or lose condition. It's playable, still growing, and built with my Claude Code plugin [hyperclaude](/projects/hyperclaude/).

## Everything runs over the roads

A zone stays empty until its type has demand, it has power, and a road sits within a few cells. Power and water spread from plants and towers through the road network, so a neighborhood off the network gets neither.

From level 1 a building extends its structure deeper into the lot, then levels up, then gains density, and every step needs water, enough land value, and all four services. Service coverage fades with road distance from the nearest station. Since every station of a type is equally strong, one breadth-first search seeded from all of them at once gives each road tile its best coverage in a single pass. Coverage also feeds land value, along with road access, the zone mix and nearby parks.

Once two neighboring lots of the same type are fully built out (top level 5, with the deepest structure and densest tier their lot allows), they can merge, and only a merged lot reaches the top density tier. Above level 1, a building whose land value falls below its level's threshold goes derelict until the value recovers.

## An unpaid month stops growth

Money is monthly tax income minus the upkeep of structures and roads, and placing anything spends from it. If a month's upkeep can't be paid in full, no building levels up, extends, densifies or merges until a month is paid in full again. New buildings still appear, nothing is abandoned over the shortfall, and an empty treasury never blocks demolition, so a broke city stalls instead of collapsing. The HUD shows the projected net flow, how much of last month's upkeep was funded, and a warning before growth freezes.

## Commutes are what make traffic

Population and jobs both come from each building's built area, level and density, so the simulation routes exactly the workers the HUD reports. A labor market sends each residential building's workers to the nearest job by road distance, spilling over to the next workplace when one fills.

Those commutes are loaded onto their shortest road paths. A spilled-over worker may be headed farther than the nearest job, so routing runs one search per destination rather than one shared search. Each road tile's load becomes its congestion, shown in a Traffic view.

Congestion feeds back. It lowers land value near busy roads and pulls down the happiness score, and the worker-job balance sets zone demand: unemployment asks for commercial and industrial zones, unfilled jobs ask for housing. One rule is deliberate. Traffic can stop a building from growing but never make it derelict, or a jammed road would empty the very buildings whose commuters jammed it.

## React stays out of the game loop

Player edits take one path. Input turns pointer and keyboard events into a tile and the active tool; the engine's `CommandDispatcher` calls pure tool functions, which read the world but never write to it, to build commands, then applies them. The simulation tick, save loading and New City reset are separate write paths, and the renderer only reads.

React mounts the canvas and draws the HUD and toolbar. `GameSession` wires Pixi, input and dispatch together outside React, and the canvas component passes it callbacks whose identity never changes, so a HUD re-render never restarts the Pixi session.

Derived data (power, coverage, land value, labor, traffic) is recomputed lazily, and marking one layer dirty marks everything downstream at the same moment. Tests hold the pure logic to 80% coverage; Pixi glue, DOM input and the session wiring are left out and checked by playing.

## Playing it

The [live build](https://zeikar.dev/cimulity/) is a static export on GitHub Pages and saves your city in the browser as you play, with a New City button to start over. Edge-scroll pans, the wheel zooms, Space pauses, and 1, 2 and 3 set the speed. To run it locally, clone the [repo](https://github.com/zeikar/cimulity), then `npm install` and `npm run dev`.
