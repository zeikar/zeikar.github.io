---
layout: project
title: "WC2008 Rating Lab"
description: "Tracker for the CPU ratings in Yu-Gi-Oh! World Championship 2008 (DS), with a headless emulator harness that played 1,600 tournaments and pinned down the game's rating formula."
tech_stack: ["React", "TypeScript", "Firebase", "Recharts", "Python", "melonDS DS", "libretro.py", "Vitest"]
github_url: "https://github.com/zeikar/yugioh-wc2008-rating-lab"
demo_url: "https://zeikar.dev/yugioh-wc2008-rating-lab/"
image: "/assets/images/projects/yugioh-wc2008-rating-lab.png"
sequence: 21
gadget_no: 21
---

In *Yu-Gi-Oh! World Championship 2008* on the Nintendo DS, every CPU duelist has a rating, and it moves after every CPU-vs-CPU duel in tournament mode. Community guides list only each duelist's starting number, and none of them says ratings move at all. WC2008 Rating Lab records those ratings while you play a tournament and charts how each of the 78 CPUs rises and falls. A Python harness plays the game headless in an emulator and reads the ratings straight from RAM, and its 1,600 tournaments ship with the site as a read-only research dataset.

## The app records ratings and never predicts them

You seat the 8 entrants, and each CPU's rating going in comes from its history. After each CPU duel you type either side's new rating. CPU duels are zero-sum, so the app fills in the other side and the winner and saves the filled-in value marked `derived`. That rule is the only thing it infers. Re-saving a tournament recomputes its derived values, so a fixed typo flows through the later rounds, and a later tournament whose entry ratings no longer match the corrected history asks to be saved again.

No statistic is stored. Peak, low, W–L, finals and streaks are derived from the stored matches and ratings when a page loads, and each duelist's page shows its in-game portrait, its deck and rating history. Roster setup can also read every CPU's current rating from the game's save file: four LZ10-compressed blocks, each with a CRC32, of which the app takes the newest valid one and reads a table of 78 u16 ratings inside.

There's no server code of its own. Data lives in Firestore with its offline cache, anyone can sign in with Google to get a save, and every save is public at its `/u/{uid}` link. Security rules, tested against the Firestore emulator, let each user write only their own.

## Playing the game with nobody at the controls

`tools/emulator` drives the melonDS DS libretro core from Python through libretro.py. The rating table sits in RAM as part of the save's decompressed data, so a script can watch it change. `tournament.py` forks a save, enters a tournament and loses the player's own duel at once by writing 0 to the player's LP. In a CPU duel those same addresses hold a CPU's LP, so it writes only when the is-CPU flags say the player's duel is on, and only on the player's side.

The CPU duels then play themselves. Each one is logged the moment both ratings change in RAM, together with the board, which still shows how the duel ended: the win condition (LP, deck-out, Exodia, Destiny Board or Vennominaga), the turn, and each side's field, hand, graveyard and banished cards, which the export names from the ROM's own card tables. A tournament takes about 35 seconds.

The first few hundred runs had a flaw no rating showed. Each level drew from the same rating ranks every time, and six Level 2 CPUs never entered at all. The draw code in the ROM explained it: the game picks entrants with a C-style `rand()` whose state, on the harness's route, stays at 1 from power-on until the draw, so every freshly booted emulator drew the same numbers. The harness now writes a random seed and frame counter at boot. `draw.py` rebuilds the game's draw in Python (3 seeds from the level's top-rated CPUs, 4 picks from the rest and the lower levels) and matches every logged bracket it was checked against.

## What 9,600 duels say

The first clue came from my own save: 35 CPUs had drifted between −354 and +620 points since a new game, yet their ratings still added up to exactly their documented starting total.

Seven early duels, four from my own play and three from the first emulator runs, then fit one curve, `floor(160 / (1 + 10^(gap / 1000)))`, where the gap is the winner's rating minus the loser's before the duel. The emulator dataset tested it at scale. All 9,600 CPU duels in its 1,600 tournaments, with gaps from −1,612 to +1,912, moved exactly the points it predicts, every one was zero-sum, and the 78 ratings still add up to their starting 94,800. The biggest swing was 156 points, when Winged Kuriboh at 250 beat Elemental Hero Lady Heat at 1,862.

It looks like Elo with a scale of 1,000 instead of 400, but it only moves points. Read as a win chance it overrates favorites: the higher-rated CPU won 62% of the time, and even 700 to 1,200 points ahead only 78%, where the curve would say 83 to 94%. The deck decides more than the rating does. Win rates run from about 7% (Marcel Bonaparte, Stray Lambs) to 72% (Jaden Yuki) and follow starting rating only loosely. The Research page lays out the data, from points moved against the gap to upsets and rivalries, and the app itself still never uses the formula.

## Where it stands

Only the Korean release (`YG8K`) has been checked, since save and RAM addresses differ between releases. The repository ships no ROM or save; the harness reads your own copies from a gitignored folder. The research dataset opens at `/research` without signing in.
