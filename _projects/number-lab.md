---
layout: project
title: "Number Lab"
description: "Seven browser machines for famous number facts, from Kaprekar's constant to aliquot sequences, each doing its arithmetic live as you watch, with no libraries."
tech_stack: ["Vanilla JavaScript", "Canvas", "Web Workers", "BigInt", "Web Audio", "Node test runner", "GitHub Pages"]
github_url: "https://github.com/zeikar/number-lab"
demo_url: "https://zeikar.dev/number-lab/"
image: "/assets/images/projects/number-lab.png"
sequence: 20
gadget_no: 25
date: 2026-10-11
---

Number Lab is a shelf of small machines for famous number facts, most of them first met in a Numberphile video. Instead of being told that 6174 catches almost every four-digit number, you type one in and watch the digit keys sort themselves, subtract, and print each round on a paper tape. Every experiment does its arithmetic in the browser as you watch, and each one has a single big moment where the computer takes on the whole problem at once.

## What's on the bench

- **[6174, Kaprekar's constant](https://zeikar.dev/number-lab/6174/).** Sort four digits both ways and subtract. **Run all 10,000** flies every four-digit number at once: one round squeezes them onto 55 values, and seven leave only 6174 and 0000.
- **[196, reverse and add](https://zeikar.dev/number-lab/196/).** 89 reaches a palindrome in 24 steps. **Run 196** keeps going for as long as you let it, printing every sum on a printout that widens into a triangle.
- **[Goldbach's conjecture](https://zeikar.dev/number-lab/goldbach/).** Fold the number line in half so every pair that sums to n lines up, then count the prime pairs for all 49,999 even numbers from 4 to 100,000 and draw Goldbach's comet.
- **[The golden angle](https://zeikar.dev/number-lab/sunflower/).** Drag the turn between seeds and watch arms form and dissolve. The page counts the arms, lists the fractions the turn is close to, and measures how tightly the seeds pack.
- **[Recamán's sequence](https://zeikar.dev/number-lab/recaman/).** Up to 400 jumps are drawn as arcs, with optional sound. **Walk 10 million steps** fills in which numbers below 2,000 the walk has reached; 1,355, 1,643 and 1,814 are still empty at the end.
- **[Perfect numbers](https://zeikar.dev/number-lab/perfect/).** Lay a number's divisors end to end against it. **Hunt** tests 2^p − 1 for every prime p and prints the newest perfect number in full.
- **[Aliquot sequences](https://zeikar.dev/number-lab/aliquot/).** Add up the divisors and repeat. 138 climbs to 179,931,895,322 before it falls to 0; 276 climbs until you stop it.

## Arithmetic that runs until you stop it

Three of the machines have no finish line, so they're built to keep going without freezing the page.

- **196 never ends,** as far as anyone knows. Its digits live in `Uint8Array` buffers, ones digit first, swapped each step and doubled when full. Each frame gets a 9 ms budget, and the speed holds at three steps a second for the first 12 lines, then doubles every 1.3 seconds. The printout stores marks as alpha only and tints them when drawn, so switching to dark mode recolours a run that's already thousands of lines long.
- **The Mersenne hunt runs in a Web Worker.** It runs the Lucas–Lehmer test on every odd prime exponent, in BigInt, and reduces modulo 2^p − 1 by folding `(s & M) + (s >> p)` instead of dividing. The first 20 perfect numbers arrive quickly; after that each one takes noticeably longer, which is the point.
- **Following 276 means factoring huge numbers.** The aliquot worker does trial division by primes below 65,536, then Miller–Rabin (the 13 primes up to 41 as bases, which prove primality below 3.3 × 10²⁴, plus 20 random bases above that), then Pollard's rho with Brent's cycle finding, batching 128 multiplications per gcd. The worker posts each term before it starts factoring, so the page can show which number it's working on and for how long.

## Ten thousand of everything

Four of the machines take on thousands of cases at once instead of one example, and each needed its own trick to stay smooth.

- **6174** precomputes where all 10,000 numbers go, flies them as squares in round one, then flies whole piles as discs, since every number on the same value goes to the same place next. Squares are grouped by colour, so a frame sets the fill a handful of times, not 10,000.
- **Recamán's 10 million steps** take about seven seconds, ten times more steps each second. The walk keeps the numbers it has visited in a bitset that doubles as it grows, and only checks the clock every 65,536 steps.
- **Goldbach's comet** sieves the primes up to 100,000 once, then counts pairs in a sweep paced to finish in about three seconds, plotting into an offscreen canvas as it goes.
- **The golden angle** finds the closest pair of seeds with a spatial hash and recomputes on every slider move, along with the arm count and the continued-fraction convergents of the turn.

## Every number the browser can compute is a test

Number facts are easy to get slightly wrong, so each experiment keeps its arithmetic in a pure module with Node's built-in test runner, 80 tests in all. The numbers the pages state are asserted there: the 55 values and seven rounds of 6174, the 246 numbers below 10,000 with no palindrome after 1,000 steps, Recamán's 19 at step 99,734. Records the browser can't reproduce, like Goldbach verified to 4 × 10¹⁸ or the 52 known Mersenne primes, are quoted as records instead, and the notes link each one to its source.

The lab's rules count edge cases too: 6174's first draft ignored the ten repdigits like 7777, which fall to 0000 instead.

## One lab, one set of materials

All seven share a look borrowed from old calculating machines: a grey-green enamel body, paper tape, black ink, and red ribbon ink kept for the answer. Ordered steps take a blue ramp that steps evenly from light to dark in both themes, and the site follows the system's dark mode. The machine parts (keys, panels, tape with a torn edge, histograms) live in one shared stylesheet, and each experiment builds its own machine from them. There's no framework and no JavaScript library; the only outside requests are for Google Fonts. The number you choose lives in the URL hash, so a link like `6174/#n=3524` runs that number.

## Where it stands

Seven experiments are live, and more Numberphile topics are queued. Number Lab is an unofficial fan project, not affiliated with Numberphile.
