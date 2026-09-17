---
layout: project
title: "Ludoweft"
description: "Claude Code and Codex plugin where an agent translates a game's text and a deterministic CLI extracts, validates and rebuilds the game files."
tech_stack: ["Node.js", "Claude Code plugin", "Codex plugin", "JSONL", "FreeMote"]
github_url: "https://github.com/zeikar/ludoweft"
image: "/assets/images/projects/ludoweft.png"
sequence: 7
gadget_no: 20
---

Ludoweft is a toolkit for making fan translation patches with a coding agent, aimed at text-heavy PC games like visual novels. An adapter turns game resources into a JSONL workspace, the agent translates and reviews it, and the CLI validates the result and rebuilds the files. It ships no game assets, keys or translated text. The same skill and CLI install as a plugin for Claude Code or Codex, with no npm dependencies.

## The agent translates, the CLI keeps the gates

The CLI never calls a model. The agent decides what a line says, and every check reads data the agent can't edit to get a pass:

- **Source hashes.** `sourceHash` is a SHA-256 of a row's source and reference text, recomputed by `validate` from the row and by `apply` from the extracted resource. When an upstream update changes a line, `export` keeps the old translation but marks it `stale`, and nothing builds until it's revised. A line removed upstream becomes `orphaned`, not deleted.
- **Protected tokens.** Placeholders, markup, line breaks and engine control codes are recomputed from the extracted text at apply time, not read from the row. Counts are compared both ways, so a placeholder the translation drops and one it invents both fail.
- **Status.** Only `translated` and `reviewed` rows reach a build.
- **No leftovers.** `apply`, `build` and `verify` each re-derive the expected resource from the current sources and workspace, so output from an earlier run can't be built or certified.

For FreeMote info-PSB archives, the build overlays only the modified entries onto a raw extraction, then re-extracts its own output: untouched entries must match the original byte for byte, and modified ones must equal what `apply` wrote, allowing for float32 values FreeMote writes to JSON as doubles.

## What the gates can't see

Every gate checks structure. The bundled skill covers the rest, much of it learned in real runs:

- **Prove the target language renders first.** Fonts are often remapped per language for the body face only. On a MAGES title that left ruby as missing-glyph boxes, which looked like the engine couldn't do ruby; mapping the `ruby` face fixed it in-game.
- **Check the font has every character.** In one title a full-width `＠` hung a chapter load on a black screen after passing every check. The skill has the agent list every target character the reference text never uses, since nothing shows the font can draw it.
- **Escapes are invisible.** A literal `%` in MAGES text is written `\%`, and a missing backslash passes validation, so the skill has the agent tally the escapes in the shipped localization first.
- **Check what actually diverges.** Parallel workers agreed on every term the glossary had missed but split on quotation marks, so punctuation gets compared mechanically before a merge.

## Where it stands

Pre-alpha; adapter APIs may still change. The experimental `freemote-info-psb` adapter is verified only against STEINS;GATE RE:BOOT, with other MAGES titles listed as untested. It isn't on npm; the plugins install from GitHub:

```
claude plugin marketplace add zeikar/ludoweft
claude plugin install ludoweft@ludoweft
```

```
codex plugin marketplace add zeikar/ludoweft
codex plugin add ludoweft@ludoweft
```
