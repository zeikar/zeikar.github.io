---
layout: project
title: "Whozzie"
description: "Random name picker that keeps one list of names for a spinning wheel, real-physics 3D dice and a ladder game, in English and Korean."
tech_stack: ["Next.js", "three.js", "React Three Fiber", "Rapier", "next-intl", "TypeScript", "Web Crypto API", "Tailwind CSS", "Vitest"]
github_url: "https://github.com/zeikar/whozzie"
demo_url: "https://whozzie.vercel.app"
image: "/assets/images/projects/whozzie.png"
sequence: 21
gadget_no: 9
---

Whozzie ("Who's it gonna be?") is for the moment a group can't decide. Write the names down once, then spin a wheel, roll 3D dice, or play the ladder game (Amidakuji) with the same list, and whoever gets picked is circled in red pen. There's no sign-up, and the names never leave the browser.

## The animation never decides

Every pick comes from `crypto.getRandomValues`, never `Math.random`. `randomInt` redraws the values that would favor low remainders, and `shuffle` is a Fisher-Yates shuffle on top of it. Each tool then has to keep its animation from having a say:

- **The wheel draws the winner before it moves.** The spin is aimed at that slice: five to seven full turns, plus the way round to it, over 5.2 seconds, stopping anywhere from 12% to 88% of the way across it. The first version did it the other way round, turning the wheel a random whole number of degrees and reading the winner off where it stopped. With seven names, that gave three slices 52 of the 360 possible stops and the other four 51.
- **The ladder's rungs aren't the draw.** A line with few rungs mostly runs straight down, so whoever stands on it most likely gets the result below. Players are seated on the lines in a uniformly shuffled order instead, and a uniform shuffle composed with any fixed ladder is still uniform, so each player lands on each result with probability 1/n however the rungs fall. The results (one winner, a full order, or the group's own text such as chores) are shuffled along the bottom and taped over, so the covered slots give nothing away. Tests deal tens of thousands of rounds and check the odds to within about six standard deviations, including on a ladder whose rungs fall the same way every round.
- **The dice are thrown, not scripted.** Crypto randomness sets up each throw and the physics does the rest.

Randomness that's only for looks, like the wobble of a hand-drawn line, comes from a seeded PRNG so the server and the browser draw the same thing. It never touches a pick.

## Dice that actually roll

The dice are rigid bodies in a Rapier physics world, drawn with three.js through React Three Fiber. A throw comes in from a random side wall, with each die's starting spot, orientation, velocity and spin drawn from crypto randomness, and the starting spots shuffled between players. The face on top when they stop is the roll. The walls sit just inside the camera's frame, and the camera pulls back as dice are added, so no die rolls out of view.

- **Knowing when a throw is over.** Every die has to stay still for a quarter of a second. A die leaning on a wall or another die, with its top face more than about 25° off level, isn't read: it gets a bump upward and three more seconds to fall flat, up to three times per throw. Waiting is capped too: seven seconds for the throw and three more after each nudge, and after the third nudge the face pointing most nearly up counts.
- **Ties roll again.** In Everyone rolls (2 to 12 names), only the players tied for the top roll again, until one is left, and people tied further down share a place. The other mode, Just roll, throws up to six plain dice and adds them up, for a board game whose dice have gone missing.
- **No physics, still a fair roll.** With reduced motion, each face is drawn directly as a uniform 1 to 6 and the dice are set down showing it. If the 3D table can't start (no WebGL, say), an error boundary catches it and the page keeps rolling the same fair numbers without the table.
- **Idle means idle.** three.js and Rapier load only on the dice page, after it's up. Between throws the physics world is paused and the canvas draws only when something changes. During a throw each frame steps the world itself, in slices of at most 1/90 of a second.

The dice are shaded in three flat tones, like a face colored in with a marker, with an ink outline and slightly wobbly pips. An invisible floor catches their shadows, so the shadows fall on the page itself.

## One list for every tool

The names live in `localStorage`, shared by all three tools and synced across open tabs through the `storage` event. A result belongs to the list it was drawn from, so editing the names, even from another tab, clears it rather than leaving a stale winner.

- **Paste whatever list you have.** One name per line, comma-separated, or rows copied from a spreadsheet: a line with tabs becomes one name, with a numbering column like `1.` dropped. It takes up to 100 names of up to 40 characters, and duplicates are skipped with a note saying which.
- **Hangul counts once.** Names are normalized to NFC, so the same name typed on one device and pasted from another (a macOS file name, say) doesn't go on twice, and the length cap counts syllables. The Enter that finishes composing a syllable doesn't add half a name, a bug the first version shipped with.
- **Undo puts a name back where it was.** A name removed from its chip or from the result slip can be restored for six seconds, in its old position, so it gets its color back.
- **One color per person.** Each name gets one of eight marker colors from its place in the list, on its chip, wheel slice, die and ladder line.

## Graph paper and a red pen

The light theme is the back page of a school notebook: graph paper, ballpoint-blue ink, highlighter colors and a red margin rule. The dark theme is a classroom chalkboard, with an SVG noise filter breaking the drawings into chalk grain. The wheel and the ladder are drawn in lines that bow and wobble like a hand's, and headings, names and buttons are in the Gaegu handwriting font.

Red is kept for the verdict. Whoever gets picked is circled in red pen, in the names list, on the result slip, on the dice's name tags and on the ladder, with a loop that overshoots its start the way people circle things. The loop is seeded with the name, so the same name always gets the same circle. On the ladder, a highlighter traces the line down and the masking tape peels off the result it lands on.

## Where it stands

Whozzie started in April 2025 as a single wheel, with Korean from the first day: the locale routing went in before the wheel did. In September 2026 it was rebuilt around the notebook design and a shared picker layer, and the dice and the ladder game were added on top. Each tool is a folder of components and plain logic with Vitest tests beside it, and CI runs lint, typecheck, tests and a production build. Type checking runs on TypeScript 7, installed side by side with the TypeScript 6 API package that typescript-eslint and `next build` still need. Every page's link preview is a [DOGimg](/projects/dogimg/) card.
