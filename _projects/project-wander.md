---
layout: project
title: "Wander"
description: "Text-first travel game in the browser: cross a seeded map of a region you don't know, read the signs on the road, and keep nothing between journeys but what you've learned."
tech_stack: ["TypeScript", "React", "Vite", "Vitest", "Canvas 2D", "SVG", "localStorage", "GitHub Actions"]
github_url: "https://github.com/zeikar/project-wander"
demo_url: "https://zeikar.dev/project-wander/"
image: "/assets/images/projects/project-wander.png"
sequence: 9
gadget_no: 24
date: 2026-07-28
---

Wander is a short travel game told mostly in text, played in the browser in Korean or English. Each journey crosses a region you don't know: a village at the bottom of a small map, five days of road, and three far places at the top, each known only from a rumour heard before setting out. Every day you pick a road. From a day away you see only a sign, like several sets of tracks in a single line. On arrival there's an animal, a place, a person or a quiet day, and how you deal with it trades health against food. Reach a far place and you see its sight only if your notebook holds the fact it needs. Otherwise you miss it, and the game tells you what kind of thing you were missing. There are no levels, gear or gold. What carries over is what you know: the notebook, the regions a sight has opened, the far places you've reached and the people you've met.

## The whole journey is rolled before the first step

Pressing "Set out" draws one seed, and `generateMap` turns it into the entire journey up front. It picks two or three roads for each day and what waits on each: an animal 55% of the time, a place 30%, a person 6%, otherwise a quiet day. It picks the situation each scene is in, say a boar rooting in the mud or one that has already caught your scent. And it picks the sky and wind for every day, with the odds of rain, fog and gale set per region. From then on, play rolls nothing. The generator is mulberry32, and the caller threads its state by hand, so there's no module-level state. The project's rules keep `core/` from importing React, the DOM, `Date`, `Math.random` or the translations. The UI's only randomness is the new seed and the weather drawing.

Rejection sampling keeps each map varied. Nothing appears twice in one day, no scene comes two days running whichever road you take, and no person turns up twice. A repair pass keeps it fair: every far place's key fact can be learned somewhere on the map, without taking the only road that teaches another far place's key. Roads link each stop to the two nearest in the next day, so they cross. If they never crossed, about a third of days would leave only one road onward, and that is no choice at all.

## Knowing an animal shows the price, not the answer

The world is small on purpose: 3 regions, 9 species (two of them monsters, the marsh lantern and the hill horse), 18 facts, 29 scenes and 9 far places. A fact you know doesn't change what's going on, only how much you see and what you can do about it. Signs on the map name the animal behind them. A scene's tell, the detail that gives away its situation, becomes readable, and options with an uncertain outcome show their cost. Options that need the fact appear, marked +, and the options for watching to learn it disappear once you have.

[![A Wander scene with an empty notebook: the boar's tell printed out of register, its meaning not clear yet, and one option marked "no telling how it will go"](/assets/images/projects/project-wander-unread.webp)](/assets/images/projects/project-wander-unread.webp)

On the page, a tell you can't read is printed out of register, offset in the animal's colour. Once you can read it, it's underlined in that colour instead. The whole game is set as a two-colour field guide in the Hahmlet serif, one spot colour per species, with the map drawn in SVG. The menu never leaks what you can't see. For a scene you can't read yet, whether you can afford an option is judged on its costliest situation, and a watching option goes only when every situation's lesson is already known.

Knowledge shows a price rather than waiving it because of a balance pass. Two informed answers had been free whichever situation you met, so knowing the animal settled its scene. The same pass cut the free food that knowledge finds at the wolves' kill and the deer's trail from 2 to 1. In the first region, the situations left with only one sensible answer for a player who knows everything went from 5 of 15 to 2. A content test now holds every species beyond the first region to the rule. Taking the roots a boar has dug up still costs 2 health when the boar is alert: knowing boars tells you which one you're facing, not that it's safe.

## The sky decides some scenes

Weather is part of the game, not the backdrop. Three scent scenes, boars at a ford, wolves in the pines and deer at the water at dawn, take their situation from the day's wind, unless it rains. The roll they would have used is still drawn, so making a scene follow the wind doesn't reshuffle the rest of the seed. Some options close by sky: the fire in rain, poling around in fog, three ridge options in a gale. A closed option stays on the menu, disabled, with its reason, so you learn what the weather takes away. Fog hides the signs on the map but keeps the road names. A translation test checks that every road name in a region is shared by more than one kind of road, so a name never gives away what fog hides.

The sky covers the whole page. Rain is hatching slanted by the wind, and wind is brush strokes, both drawn on a Canvas 2D layer: one stroke on a clear day, up to six in a gale, with up to 24 blades of grass tumbling past. Fog is a paper-coloured CSS haze. On the map, the page shows tomorrow's sky. An earlier pass drew gusts and tumbling flecks, and a steady pace replaced it within the hour. Wind that sped up and slowed down read as a fault, and slow specks on a mild day as dust on the screen. The layer is hidden from screen readers, takes no clicks and holds still under reduced motion.

## Starting over from the prototype

The first version, kept at the `v0-prototype` tag, had eight fixed legs of road with some forking two ways, one village and five species learned in layers. It was built over two months and 136 commits. Its measurements became the rules for the second. An option worth 3 food was taken 99.8% of the time, so a new choice has to offer a different kind of trade, not a bigger one. Knowing an animal made its answer free, so what a player had learned collapsed every journey into one table of answers. That's why knowledge now shows a price. And a choice the player can't read isn't a choice.

On 1 October the game started over as a seeded map where knowledge is the lens. In four days it gained regions chained by sights, people on the road, weather and English. Not every idea stayed. One change made a miss name the road where you'd walked past the key, and it came out the same day. A miss now says only what was missing.

## Two languages, and only ids in the state

Game state holds only ids. Every word lives in `src/i18n/`, a Korean file and an English one of about 1,600 lines each, typed by one `Strings` interface. Anything that depends on a number or a name is a function, so each language handles its own grammar, Korean particles included. A saved choice wins, then the browser's language, with Korean as the fallback. English arrived as one new file and one line in the registry, and a test walks the game data and fails on any scene, situation, option, fact or far place a locale is missing.

What you know is kept in localStorage under versioned keys. Loading filters it against the current content, and a store that won't load falls back to an empty notebook with a warning in the console. A journey in progress isn't saved: reloading takes you back to the title.

## 4,583 tests and simulated players

Vitest runs 4,583 tests in about a second. 4,516 of them check maps across 300 seeds in each of the three regions: structure, reachability, at least two roads out of every stop, no repeats, the keys guaranteed, the wind-driven situations, and each sky's share staying within 0.08 of its odds. The generator has a golden roll. One rule test checks that with an empty pack, under every sky, every scene still has a certain way through that you can afford.

Tests find broken numbers but not whether a journey is worth taking, so every milestone ends with someone playing it. The repo carries a Claude Code playtest setup for that. A throwaway sweep plays hundreds of seeded journeys under several strategies, player personas write down a prediction before each outcome, and a critic weighs both.

The game was built with [hyperclaude](/projects/hyperclaude/), with Codex reviewing plans and code. A push to main typechecks, tests and builds on GitHub Actions, then deploys to GitHub Pages. React is its only runtime dependency.

## Where it stands

Three regions are playable, each opened by a sight in the one before. Ashdale Fields comes first, seeing the white stag opens Willow Marsh, and seeing the lantern shoal opens the Windy Hills. People on the road remember you, and a far place you've seen or missed before is told differently the next time. No sight in the hills opens a region beyond them yet, and whether a village should ever be the thing that opens one is still an open question in the design notes. The notes leave room for AI to describe people and journeys, but never to decide what anything costs: the game has to be fully playable without it.
