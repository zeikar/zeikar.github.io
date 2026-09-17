---
layout: project
title: "Pokémon Numerals"
description: "A numeral system where n is the Pokémon with National Pokédex number n, shown on a live clock and a converter, with a silhouette hardcore mode."
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
- **Past the last Pokédex number, it's positional.** In Gen 1, with MissingNo. as the zero digit, there are 152 digits, so 152 is written `10` (Bulbasaur, MissingNo.) and 2026 is Weedle, Diglett.
- **Negative numbers are written upside down.** No minus sign.
- **The base grows with every new generation.** Backwards compatibility is not guaranteed, unless you pick an older generation.

## What's on the page

- **A live clock and date** on a handheld-style LCD. The clock ticks every second and the colons blink, and the Clock key (or `#clock` in a link) shows only the clock, full screen.
- **A numeral system switch.** Decimal, Binary and Hexadecimal sit next to Pokémon as if nothing were unusual.
- **A generation picker.** Gen 1 is the default; pick Gen 9 and the base grows to 1026, so 2026 becomes Bulbasaur, Gholdengo.
- **A converter** that takes any whole number up to 40 digits and shows the place-value expansion (`2026 = 13 × 152¹ + 50 × 152⁰`). The number, generation and hardcore mode stay in the address, so a link like `?n=2026&gen=9` opens the same view.
- **Hardcore mode**, which turns every sprite into a silhouette. Work out the time from the silhouettes alone.

## How it's built

There's no build step and no framework: a static page, a few hundred lines of JavaScript, and a JSON file.

- **BigInt conversion.** Arbitrary-size numbers convert exactly, and no base is hardcoded: each generation's base is its last Pokédex number plus one, read from the data, so a new generation only needs a data refresh.
- **Names from PokéAPI's CSV.** A small Node script turns PokéAPI's species tables into a JSON file of English and Korean names plus the last number of each generation. It fails loudly if any name is missing, or if the two tables end at different numbers, instead of shipping half a Pokédex.
- **A clock that doesn't flicker.** Only the digits that changed are replaced each second, and the sprites for 1–59 are preloaded (zero is a local MissingNo. image), so the hours and minutes don't reload every tick.

Pokémon names and sprites come from [PokéAPI](https://pokeapi.co/). This is an unofficial fan project, not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company.
