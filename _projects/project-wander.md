---
layout: project
title: "Wander"
description: "Text-first travel game in the browser: cross a seeded map of a region you don't know, read the signs on the road, and keep nothing between journeys but what you've learned."
tagline: "Text-Based Travel Game for the Browser"
tech_stack: ["TypeScript", "React", "Vite", "Vitest", "Canvas 2D", "SVG", "localStorage", "GitHub Actions"]
github_url: "https://github.com/zeikar/project-wander"
demo_url: "https://zeikar.dev/project-wander/"
image: "/assets/images/projects/project-wander.png"
sequence: 12
gadget_no: 24
date: 2026-07-28
---

Wander is a short travel game told mostly in text, played in the browser in Korean or English. Each journey crosses a region you don't know: a village, five days of road, and three far places known only from a rumour. Every day you pick a road, seeing from a day away only a sign, like several sets of tracks in a single line. On arrival there's an animal, a place, a person or a quiet day, and how you deal with it trades health against food. Reach a far place and you see its sight only if your notebook holds the fact it needs; otherwise the game tells you what kind of thing you were missing. There are no levels, gear or gold. What carries over is what you know: the notebook, the regions a sight has opened, the far places you've reached and the people you've met.

## The whole journey is rolled before the first step

Pressing "Set out" draws one seed, and `generateMap` turns it into the entire journey up front: two or three roads for each day, what waits on each, the situation each scene is in (a boar rooting in the mud, or one that has already caught your scent), and every day's sky and wind. From then on, play rolls nothing. The generator is mulberry32 with its state threaded by hand, and the project's rules keep `core/` from importing React, the DOM, `Date`, `Math.random` or the translations.

Rejection sampling keeps each map varied: nothing appears twice in one day, no scene comes two days running whichever road you take, and no person turns up twice. A repair pass keeps it fair, so every far place's key fact can be learned somewhere on the map without taking the only road that teaches another one's. Roads link each stop to the two nearest in the next day, so they cross. If they never crossed, about a third of days would leave only one road onward, and that is no choice at all.

## Knowing an animal shows the price, not the answer

A fact you know doesn't change what's going on, only how much you see and what you can do about it: signs on the map name the animal behind them, a scene's tell (the detail that gives away its situation) becomes readable, uncertain options show their cost, and options that need the fact appear.

[![A Wander scene with an empty notebook: the boar's tell printed out of register, its meaning not clear yet, and one option marked "no telling how it will go"](/assets/images/projects/project-wander-unread.webp)](/assets/images/projects/project-wander-unread.webp)

The game is set as a two-colour field guide, one spot colour per species. A tell you can't read is printed out of register, offset in the animal's colour; once you can read it, it's underlined in that colour. The menu never leaks what you can't see: for a scene you can't read yet, whether you can afford an option is judged on its costliest situation.

The first prototype, kept at the `v0-prototype` tag, showed what happens when knowledge waives the price: a known animal's answer was free, and what a player had learned collapsed every journey into one table of answers. Its 3-food option was taken 99.8% of the time, so a new choice has to offer a different kind of trade, not a bigger one. When the game started over, a balance pass gave a price to two informed answers that were still free in every situation. In the first region, the situations left with only one sensible answer for a player who knows everything went from 5 of 15 to 2 (2 of 16 once rain added a situation at the water), and both are deliberately easy days. A content test now holds every species beyond the first region to that rule: an informed answer is never free in the dangerous situation. Taking the roots a boar has dug up still costs 2 health when the boar is alert: knowing boars tells you which one you're facing, not that it's safe.

## The sky decides some scenes

Weather is part of the game, not the backdrop. Three scent scenes, such as wolves in the pines, take their situation from the day's wind, or from the rain when it rains. The roll they would have used is still drawn, so following the wind doesn't reshuffle the rest of the seed. Some options close by sky, like the fire in rain or the ridge options in a gale, and stay on the menu disabled with their reason, so you learn what the weather takes away. Fog hides the signs on the map but keeps the road names, and a translation test checks that every road name in a region is shared by more than one kind of road, so a name never gives away what fog hides.

On the page, rain and wind are drawn on a Canvas 2D layer and fog is a paper-coloured haze, with tomorrow's sky shown over the map. That drawing is the UI's only randomness besides the new seed, and it holds still under reduced motion.

## Two languages, and only ids in the state

Game state holds only ids. Every word lives in `src/i18n/`, one Korean file and one English, typed by one `Strings` interface. Anything that depends on a number or a name is a function, so each language handles its own grammar, Korean particles included. English arrived as one new file and one line in a registry, and a test walks the game data and fails on any scene, situation, option, fact or far place a locale is missing.

## 4,583 tests and simulated players

Vitest runs 4,583 tests in about a second. Most of them check maps across 300 seeds in each region: at least two roads out of every stop, no repeats, the keys guaranteed, each sky's share within 0.08 of its odds. One rule test checks that with an empty pack, under every sky, every scene still has a certain way through that you can afford.

Tests find broken numbers, not whether a journey is worth taking, so every milestone ends with someone playing it. The repo carries a Claude Code playtest setup for that: a throwaway sweep plays hundreds of seeded journeys under several strategies, player personas write down a prediction before each outcome, and a critic weighs both. It was built with [hyperclaude](/projects/hyperclaude/), with Codex reviewing plans and code, and every push to main is tested, built and deployed to GitHub Pages.

## Where it stands

Three regions are playable, Ashdale Fields, Willow Marsh and the Windy Hills, each opened by a sight in the one before; none in the hills opens a region beyond them yet. The design notes leave room for AI to describe people and journeys, but never to decide what anything costs: the game has to be fully playable without it.
