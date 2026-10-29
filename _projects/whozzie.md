---
layout: project
title: "Whozzie"
description: "Random name picker that keeps one list of names for a spinning wheel, real-physics 3D dice and a ladder game, in English and Korean."
tagline: "Random Name Picker with Wheel, Dice & Ladder"
tech_stack: ["Next.js", "three.js", "React Three Fiber", "Rapier", "next-intl", "TypeScript", "Web Crypto API", "Tailwind CSS", "Vitest"]
github_url: "https://github.com/zeikar/whozzie"
demo_url: "https://whozzie.vercel.app"
image: "/assets/images/projects/whozzie.png"
sequence: 25
gadget_no: 9
date: 2025-04-22
---

Whozzie ("Who's it gonna be?") is for the moment a group can't decide. Write the names down once, then spin a wheel, roll 3D dice, or play the ladder game (Amidakuji) with the same list, and whoever gets picked is circled in red pen. There's no sign-up, and the names never leave the browser.

## The animation never decides

Every pick comes from `crypto.getRandomValues`, never `Math.random`: `randomInt` redraws values that would favor low remainders, and `shuffle` is a Fisher-Yates shuffle on top of it. Each tool keeps its animation from having a say:

- **The wheel draws the winner before it moves.** The spin is aimed at that slice: five to seven full turns over 5.2 seconds, stopping anywhere from 12% to 88% of the way across it rather than dead center. The first version spun a random whole number of degrees and read off the winner, which gave three of seven slices 52 of the 360 stops and the rest 51.
- **The ladder's rungs aren't the draw.** A line with few rungs mostly runs straight down, so whoever stands on it most likely gets the result below. Players are seated in a uniformly shuffled order instead, and a uniform shuffle composed with any fixed ladder is still uniform, so each player lands on each result with probability 1/n however the rungs fall. The results are shuffled and taped over too, so the covered slots give nothing away. Tests deal tens of thousands of rounds and check the odds to within about six standard deviations, including on a ladder whose rungs fall the same way every round.
- **The dice are thrown, not scripted.** Crypto randomness sets up each throw and the physics does the rest.

Randomness that's only for looks, like the wobble of a hand-drawn line, comes from a seeded PRNG so the server and the browser draw the same thing. It never touches a pick.

## Dice that actually roll

The dice are rigid bodies in a Rapier physics world, drawn with three.js through React Three Fiber. Each die's starting spot, orientation, velocity and spin are drawn from crypto randomness, and the face on top when they stop is the roll. When everyone rolls for a pick, only those tied for the top roll again, until one is left.

The hard part is knowing when a throw is over. Every die has to stay still for a quarter of a second, and a die leaning on a wall or another die, with its top face more than about 25° off level, isn't read: it gets a bump upward and three more seconds to fall flat, up to three times per throw. After the third nudge, the face pointing most nearly up counts.

A fair roll doesn't depend on the physics running. With reduced motion, each face is drawn directly as a uniform 1 to 6 and the dice are set down showing it. If the 3D table can't start (no WebGL, say), an error boundary catches it and the page keeps rolling the same fair numbers without it.

The dice page loads three.js and Rapier only once it's up, and between throws the physics world is paused and the canvas draws only when something changes.

## One list for every tool

The names live in `localStorage`, shared by all three tools and synced across open tabs through the `storage` event. A result belongs to the list it was drawn from, so editing the names, even from another tab, clears it rather than leaving a stale winner.

A list can be pasted as lines, commas or spreadsheet rows. Names are normalized to NFC, so the same Hangul name typed on one device and pasted from another doesn't go on twice, and the Enter that finishes composing a syllable doesn't add half a name. A removed name can be restored for six seconds, in its old position, so it keeps its color: each name gets one of eight marker colors from its place in the list, on its chip, wheel slice, die and ladder line.

## Graph paper and a red pen

The light theme is the back page of a school notebook: graph paper, ballpoint-blue ink, highlighter colors and a red margin rule. The dark theme is a classroom chalkboard, with chalk grain on the drawings. The wheel and the ladder are drawn in lines that bow and wobble like a hand's, and the dice are shaded in three flat marker tones.

Red is kept for the verdict. Whoever gets picked is circled in red pen in the names list, on the result slip, and on the dice and the ladder, with a loop that overshoots its start, seeded with the name so the same name always gets the same circle. On the ladder, a highlighter traces the line down and the masking tape peels off the result it lands on.

## Where it stands

Whozzie started in April 2025 as a single wheel, in English and Korean from the first day. In September 2026 it was rebuilt around the notebook design, with the dice and the ladder game added on top. Each tool keeps its logic in plain modules with Vitest tests beside them, and CI runs lint, typecheck, tests and a production build. Every page's link preview is a [DOGimg](/projects/dogimg/) card.
