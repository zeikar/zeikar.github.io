---
layout: project
title: "Pokémon Numerals"
description: "A numeral system where every number is a Pokémon: n is the Pokémon with National Pokédex number n, shown on a live clock, a converter, and a silhouette hardcore mode."
tech_stack: ["Vanilla JavaScript", "BigInt", "CSS", "PokéAPI", "Node test runner", "GitHub Pages"]
github_url: "https://github.com/zeikar/pokemon-numerals"
demo_url: "https://zeikar.dev/pokemon-numerals/"
image: "/assets/images/projects/pokemon-numerals.png"
sequence: 18
gadget_no: 18
---

What if numbers were Pokémon? Pokémon Numerals answers that question with complete seriousness. An integer *n* is written as the Pokémon whose National Pokédex number is *n*, so `01:04:25` reads Bulbasaur : Charmander : Pikachu. Practical applications have not been observed.

## The rules

Treating the Pokédex as a lookup table works until the first edge case, so the system needed an actual definition:

- **Zero is MissingNo.** Every clock hits `:00` once a minute, and the famous glitch Pokémon shows up in Red and Blue as No. 000.
- **Past the last Pokédex number, it's positional.** With MissingNo. as the zero digit there are 1026 digits, so 1026 is written `10` (Bulbasaur, MissingNo.) and 2026 is Bulbasaur, Gholdengo.
- **Negative numbers are written upside down.** No minus sign.
- **The base grows with every new generation.** Backwards compatibility is not guaranteed.

## What's on the page

- **A live clock and date** on a handheld-style LCD. The clock ticks every second and the colons blink.
- **A numeral system switch.** Decimal, Binary and Hexadecimal sit next to Pokémon as if nothing were unusual.
- **A converter** that takes any whole number up to 40 digits and shows the place-value expansion (`2026 = 1 × 1026¹ + 1000 × 1026⁰`).
- **Hardcore mode**, which turns every sprite into a silhouette. Work out the time from the silhouettes alone.

## How it's built

There's no build step and no framework: a static page, a few hundred lines of JavaScript, and a JSON file.

- **BigInt conversion.** Arbitrary-size numbers convert exactly, and the base is read from the data length rather than hardcoded, so a new generation only needs a data refresh.
- **Names from PokéAPI's CSV.** A small Node script turns PokéAPI's species-name table into a 1025-entry English/Korean JSON file. It fails loudly if any name is missing instead of shipping half a Pokédex.
- **A clock that doesn't flicker.** Only the digits that changed are replaced each second, and the sprites for 0–59 are preloaded, so the hours and minutes don't reload every tick.

Pokémon names and sprites come from [PokéAPI](https://pokeapi.co/). This is an unofficial fan project, not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company.
