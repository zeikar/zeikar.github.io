---
layout: project
title: "Memory Lane"
description: "A browser game: pick a place you know, draw its streets from memory on a 1 km sheet, then lay the real OpenStreetMap network over your drawing and see what you remembered, what you forgot and what you made up."
tagline: "Draw Your Neighbourhood's Streets from Memory"
tech_stack: ["TypeScript", "Canvas", "OpenStreetMap", "Vector Tiles", "Vite", "Vitest"]
github_url: "https://github.com/zeikar/memory-lane"
demo_url: "https://zeikar.dev/memory-lane/"
image: "/assets/images/projects/memory-lane.png"
gadget_no: 32
date: 2026-11-15
---

Memory Lane asks how well you know a place. Search for a neighbourhood, a station or an address, and you get a square sheet 1 km across with a pin in the middle, a scale bar and north. Draw every street you can remember with the pen; you can ask for the main roads or every building to be printed first. Then reveal the real map: it inks itself outward from the pin over your drawing. Streets you remembered show blue, streets you forgot show grey, and lines that match no street get an orange highlighter as imaginary roads. The result lists the named streets you knew best and the ones you forgot, and saves as a share image labelled with the district rather than the address. "Use my location" rounds the pin to about 100 m.

It runs entirely in the browser, with no server of its own. Place search goes to Nominatim and the map comes as vector tiles; the drawing and the score stay on the device, and saving the image just downloads it.

## Scored by direction as well as distance

Real streets and your lines are cut into pieces of at most 8 m. A real piece counts as remembered when one of your lines runs within 18 m of it and within 30° of its direction. Distance alone would credit any street your line merely crosses, so one straight stroke through a grid of alleys would collect a little from every alley. Hands shake, though, and at pointer sampling rates neighbouring samples of an honest line point every which way. So a drawn piece takes its direction from the chord across 15 m of the line on either side. Simplifying the line first was the obvious fix, and it failed: with enough tremor it kept the zigzag.

The score is the harmonic mean of two shares: how much of the real street length you drew, and how much of what you drew lies on real streets. Drawing everything everywhere drags the second share down.

## Hardened against the obvious tricks

Before release, a reviewer agent spent its time trying to game the score, and each attack it found became a rule and a test.

- **Trace the sheet's grid.** Tracing the printed 50 m grid scored 54 to 74 with a 25 m tolerance, because in grid-plan districts every street sits near some grid line. The grid is now printed every 100 m and the tolerance is 18 m, and tracing it scores about 20 to 30.
- **Draw a known street again and again.** That piled up length on a real street. A drawn piece running within 12 m of one already counted is now skipped. A first version deduplicated by grid cell, and that made precision depend on how densely the pointer sampled the line, from 0.24 to 0.76 for the same drawing. The fix measures real length and checks geometry instead.
- **Hedge with spare lines.** Draw a guess, then extra lines either side of it. The extra lines are skipped as retraces, but they used to still earn recall, lifting a test drawing's score from 69 to 81. Only lines that survive the dedupe count now.

None of this costs an honest player. On live map data for Seoul, Tokyo, Paris and Manhattan, a careful drawing of every street, up to 8 m off with hand jitter, scores 99 to 100, and drawing every other street scores in the 70s.

## The map is vector tiles, not a query

The first version asked Overpass for the streets in the square, and a single request sat in its queue for about 36 seconds. It now reads OpenFreeMap's OpenMapTiles vector tiles at zoom 14, which carry every street and building, are CDN-cached and are open to cross-origin requests. The few tiles a square needs load in under a second, and are decoded in the browser into a local metric plane around the pin.

Tiles repeat features in a buffer around their edges, so each line is clipped to its own tile before the play square, or a street near a seam would be scored twice. Street names live on separate lines from the street network, so the remembered and forgotten lists score those name lines against your drawing directly. A square that straddles the antimeridian wraps its longitudes and fetches tiles from both ends of the map.
