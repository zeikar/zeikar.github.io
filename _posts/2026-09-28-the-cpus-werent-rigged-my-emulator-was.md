---
title: "The CPUs Weren't Rigged. My Emulator Was."
subtitle: "Every CPU duelist in an old Yu-Gi-Oh! DS game has a rating that moves, and nobody had written down how. Pinning it down took a sum that came out exact, an emulator with nobody at the controls, and a tournament draw that only looked rigged."
date: 2026-09-28
unit: yugioh-wc2008-rating-lab
lang: en
translations:
  ko: /blog/ko/the-cpus-werent-rigged-my-emulator-was/
description: "Recovering Yu-Gi-Oh! World Championship 2008's CPU rating formula and checking it on 9,600 headless melonDS DS duels, after a stuck rand() faked a draw pattern."
---

*Yu-Gi-Oh! World Championship 2008* on the Nintendo DS has 78 CPU duelists, and each one carries a rating: a number next to a small yellow triangle on its opponent card. Every community table I found lists one number per duelist, the value on a fresh save. None of them says the number moves.

It does. Playing Tournament mode again, I saw it change after every CPU-vs-CPU duel in the bracket, stay put after duels against me, and keep its new value after the tournament. A tournament is 8 entrants, you plus 7 CPUs, and the CPU duels can't be skipped, only sped up, so every tournament is four to six rating changes whether you watch them or not.

So I built [WC2008 Rating Lab](/projects/yugioh-wc2008-rating-lab/) to type those ratings in while a tournament plays and chart how each CPU rises and falls. That left the obvious question: how many points does a duel move?

## The sum came out exact

The first clue wasn't a duel. When I set up the app's roster, I recorded the current rating of 35 CPUs. They had drifted a long way since a new game, anywhere from −354 to +620 points. Yet they added up to 40,200, exactly the sum of their documented starting ratings.

That only happens if every duel since the save began took from one side exactly what it gave the other. Zero-sum became the one rule the app is allowed to use: type one side's new rating and it fills in the other. Later, once I could read the save file, all 78 CPUs added up to their starting 94,800 as well.

## Seven duels, one curve

Zero-sum says who pays, not how much. Four duels I recorded by hand and three from the first emulator runs (more on those below) gave seven pairs of rating gap and points moved. Beating a much weaker CPU moved few points and an upset moved many, which looks like Elo:

```
N = K / (1 + 10^(gap / S))
```

The gap is the winner's rating minus the loser's before the duel. Chess Elo uses S = 400, and that's badly wrong here. Manju of the Ten Thousand Hands at 1561 beat Reaper on the Nightmare at 792, a gap of +769, and took 23 points. S = 400 predicts about 2.

So I searched a grid: every integer K from 150 to 170, and S from 900 to 1100 in steps of 10. Rounding down, exactly one pair reproduced all seven duels:

```
N = floor(160 / (1 + 10^(gap / 1000)))
```

The same curve rounded to nearest misses five of the seven. Two of the seven were the same duel from the same bracket, run twice with different inputs in my own duel before it, and it ended the other way. Kaiser Sea Horse at 965 beat Gravekeeper's Chief at 1522 for 125 points, then lost to it for 34. The curve matched both sides.

Still, a two-parameter curve through seven points is a hypothesis. I needed thousands more duels, and I wasn't going to watch them.

## Finding the ratings in RAM

The save file came first. It's 256 KiB holding four blocks, each a `TDGY` magic, a version, a length and a CRC32 in front of an LZ10-compressed payload. The blocks come in pairs that the game takes turns overwriting, so you read the newest one whose CRC checks out. Decompressed, the 78 ratings sit at offset 0x396 as little-endian u16s in the in-game list order, and every CPU I'd recorded in the app matched. The app's roster setup reads ratings from a save the same way.

Watching ratings change live meant finding them in RAM, and a cheat code gave away where to look before I'd booted anything. An Action Replay code for the Korean release puts DP at 0x021146B0, and DP sits at offset 0x24 of the decompressed save. If RAM holds that data as one block, the block starts at 0x0211468C, and the rating table at 0x02114A22.

The harness drives the [melonDS DS](https://github.com/JesseTG/melonds-ds) libretro core from Python through [libretro.py](https://github.com/JesseTG/libretro.py), with my own ROM and save, which never leave my machine. The core leaves saves to the frontend, so the script copies the save's bytes into save RAM before the first frame (otherwise the title screen offers NEW GAME) and writes them back out itself whenever the game saves. After A on the title screen, the 156 bytes at 0x02114A22 matched the save's table exactly, and they were the only match in the 4 MiB of main RAM.

One trap on the way: libretro.py returns screenshots as RGBA whatever the core's pixel format, and reading them as BGR turns the yellow rating triangle cyan.

## Losing on purpose

A tournament has one duel the harness can't just watch: mine. Losing it honestly means passing every turn until the CPU wins, since surrender only opens on turn 10. The harness sets my LP to 0 instead, and the game calls the duel at the next Standby Phase.

The catch is that those addresses aren't mine. Each side has an on-screen LP counter, 0x022CA200 on the left and 0x022CA204 on the right, and in a CPU-vs-CPU duel they hold two CPUs' LP. Zeroing one there would decide a rated duel. What tells the cases apart is a pair of is-CPU flags, 1 for a CPU and 0 for the player, which read 1/1 in a CPU duel and 0/1 or 1/0 in mine:

```python
PLAYER_SIDE = {(0, 1): 0, (1, 0): 1}  # the is-CPU flags of the player's duel

side = PLAYER_SIDE.get((game.u16(LEFT_IS_CPU), game.u16(RIGHT_IS_CPU)))
steady, last_side = side is not None and side == last_side, side
```

The flags keep their values until the next duel starts, so during the rock-paper-scissors before my duel they still say 1/1 from the last CPU duel. That turned out to be safe: as a duel starts, both flags and both LP drop to 0 together, so stale flags never meet a live CPU's LP. The script still wants the same side on two polls in a row before it writes, in case a CPU duel ever sets its two flags a frame apart.

After that the harness presses A now and then and polls the rating table every 10 frames. When exactly two ratings change, a CPU duel is over. It logs both sides before and after, plus the duel board, which still shows how the duel ended. Of the 9,600 CPU duels logged since, 9,337 were won on LP, 254 by deck-out, five with Destiny Board, three with Exodia and one with Vennominaga. A whole tournament takes about 35 seconds.

## A pattern the emulator made up

After 375 tournaments rotating Levels 1, 2 and 3, something looked off. Six Level 2 CPUs had never entered a Level 2 tournament, so their ratings had never moved.

The first theory: Level 2 is gated by rating. No Level 2 entrant had stood below 1085, and the six missing CPUs start at 750 to 1050. On a scratch copy with the six raised to 1300, Molten Zombie entered all three Level 2 tournaments I played. Convincing.

The second theory, five minutes later: entrants fill fixed rating ranks. Ranked by current rating within their level, the same places entered 122 to 125 of 125 tournaments: ranks 1, 2, 3, 5, 14, 18 and 24 at Level 1, and 2, 3, 5, 7, 12, 14 and 15 at Level 2. Level 3 always had the same three guests from lower levels. That covered the six, which sat at ranks nobody drew, and it covered Level 1's shrinking field. Its first 25 tournaments had 23 different CPUs and its last 25 only 16, because winners climbed into the drawn ranks and stayed there.

The third theory came from the game's code instead of its output. The draw lives in overlay 19, and it's a much more ordinary rule. The game sorts the level's unlocked CPUs by rating, makes 100 random swaps among the top 12 (the top 15 at Level 3) and takes the top 3 as seeds. The other 4 are uniform random picks from the rest of the level and the unlocked CPUs of lower levels. It's random, with a thumb on the scale for the top of the ladder.

Then why fixed ranks? The random numbers come from a plain ANSI C `rand()`:

```python
class Rand:
    """The game's rand(): the ANSI C generator, 15 bits out of a u32 state."""

    def __call__(self) -> int:
        self.state = (self.state * 0x41C64E6D + 0x3039) & 0xFFFFFFFF
        return self.state >> 16 & 0x7FFF
```

Its state lives at 0x020FCD18, and on the harness's route it stays at 1 from power-on until the draw. Every freshly booted tournament rolled the same numbers, and the same numbers land on the same positions in a list sorted by rating: fixed ranks. Raising Molten Zombie to 1300 had simply moved it into one of them. Each tournament's first CPU duel repeated too, for a related reason: a fresh boot always reached it with the same frame counter, and the duels are seeded from that. Of 95 first-duel pairings seen more than once, 56 played out the same every time.

In normal play this matters much less. The game reseeds `rand()` at the first duel from a timing value, so the draws after that are random, and my real Level 2 bracket fits the rule. But the harness booted fresh for every tournament, so every draw it ever saw was a first draw.

The fix, under an hour after the first theory, was a random seed written into `rand()` at boot and a random wait of 0 to 599 frames at the menu. I threw the dataset away and started over on a fresh fork. Three hours and 300 tournaments later, a random start for the frame counter joined them. `draw.py` now rebuilds the draw in Python, with the same `rand()`, the same unstable quicksort and the same picks. It matched all 41 brackets captured in experiments and every logged tournament that kept its starting save.

The lesson I keep is that a deterministic emulator is a great instrument and a terrible sample. Forty-five tournaments replayed from one fork point gave all 270 of their CPU duels again, to the frame. Anything you run from the same starting state is one data point, however many times you run it.

## 9,600 duels

With seeding in, the fork ran 1,600 tournaments: 1,200 rotating Levels 1, 2 and 3, then 400 weighted toward Level 3, whose CPUs enter no other level. That's 9,600 CPU duels, with gaps from −1,612 to +1,912.

Every one moved exactly `floor(160 / (1 + 10^(gap / 1000)))` points. Every one was zero-sum, and the 78 ratings still add up to 94,800. Transfers ran from 1 point to 156, the biggest when Winged Kuriboh at 250 beat Elemental Hero Lady Heat at 1,862.

## It moves points. It doesn't pick winners.

The formula is Elo with S = 1000, and an Elo curve is supposed to be a win probability. Read that way, this one overrates favorites. The higher-rated CPU won 62% of the 9,600 duels. Even 700 to 1,200 points ahead it won only 78%, where the curve says 83 to 94% and chess Elo 98% or more.

The deck decides more than the rating does. Win rates run from 6.8% for Marcel Bonaparte (44 duels) and 7.2% for Stray Lambs (180 duels) to 72% for Jaden Yuki (332 duels), and they correlate only 0.36 with starting rating. Manju's ritual deck is strong when it works and bricks when it doesn't. The rating is a running score of who beat whom, not a forecast.

That's also why the app still doesn't use the formula. It records what the game shows, and the [Research page](https://zeikar.dev/yugioh-wc2008-rating-lab/research/research) lays out all 1,600 tournaments for anyone who wants to check. The notes, the harness and the draw rebuild are in the [repo](https://github.com/zeikar/yugioh-wc2008-rating-lab). Only the Korean release (`YG8K`) has been checked, and the other releases use different addresses.
