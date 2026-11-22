---
title: "Clicking Paths in Claude Code's Terminal Output"
subtitle: "Claude Code prints paths in their own colour, wraps long ones over several lines, and sometimes writes them as a shell variable or a bare file name. Making them clickable came down to guessing from the screen, checking the guess on disk, and linking nothing when in doubt."
date: 2026-11-22
unit: vaquita
lang: en
translations:
  ko: /blog/ko/terminal-path-links/
description: "How to ⌘-click paths Claude Code prints in an xterm.js terminal: colour bounds, rejoining wrapped lines, a disk check, shell variables from the same command, and unique file names."
---

I'm building [vaquita](/projects/vaquita/), a macOS app for running coding agents like Claude Code and Codex side by side. Agents keep printing things like "updated `app/src/lib/term-view.ts`", and I wanted a ⌘-click on that path to open the file in a tab inside the app.

I thought one regex would do. The trouble is that a terminal only keeps the characters. Where Claude Code meant a path to start and end isn't on the screen anywhere.

## Finding paths from the screen alone

Claude Code draws code in backticks in a colour of its own. Korean puts particles right after a word with no space, so a line like `~/.zshrc를 만듭니다` ("creates ~/.zshrc") has 를 stuck to the path. Cutting where the colour changes leaves just the path. I tried trimming Korean particles by rule first, and dropped it as too fiddly.

Claude Code also breaks long paths onto the next line itself and indents the rest. To the terminal those are two unrelated lines. When the line above reaches the right edge and the next one starts after an indent, the two are joined and tried as one path.

## Guess, then ask the disk

All of that is guessing from the shape of the screen, so it's sometimes wrong. At first the app underlined whatever looked like a path and only said "no such file" after a click. I'd held off checking the disk because it sounded heavy, but text like `"$S/battle_b_frames.png"` kept getting underlined and then failing to open, so the check went in.

It turned out light. It only asks whether a path exists (a stat, no reading), and only for the row under the pointer, once per row. A "no" is forgotten quickly, so a file an agent has just written opens right away. If the answer is slow, the path is underlined as before, and a dead network drive can't hang the app.

With the disk as a backstop, bolder guesses became safe to try. A wrong one is simply not found.

## Shell variables

Claude Code sometimes runs a command like this:

```
B=/tmp/example/scratchpad && S=$B/party && ls "$S/a.png"
```

A click on `$S/a.png` should open `/tmp/example/scratchpad/party/a.png`. The app looks for `S=` in the same command, fills in its value, and fills in the `$B` inside that value the same way.

Nothing on the screen marks where a command starts. Claude Code wraps long commands at word boundaries, so if the next line's first word would have fit at the end of the line above, the two aren't one wrapped line but separate lines. That sets the command's extent.

My first version tried to follow more shell syntax: `$` stays literal in single quotes, `S=` inside quotes doesn't count, quotes inside `$(...)` are tracked. Every review round found another case it got wrong. A line like `T="$(printf '%s' '"')"` is enough to throw the quote tracking off. And a file existing on disk doesn't mean it's the file the command meant, so a misread quote opens the wrong file.

Now a variable is filled in only when `NAME=` appears exactly once in the command and there's no `$(`, backtick or single quote anywhere in it. Anything doubtful links nothing. Handing the text to a real shell would be simpler, but terminal output is untrusted input, and one `S=$(rm -rf ~)` would be the end of that.

One caveat: current Claude Code folds a finished Bash call into a single "Ran 1 shell command" line, so this mostly helps in the expanded view (⌃O).

## Bare file names

Agents often write just `path-link-provider.ts`. Looking only in the folder the session started in finds the files at the top of the repo and little else. So the app reads the repo's file list with `git ls-files` and links a name only when exactly one file in the repo has it. A name like `index.ts`, shared by several files, links nothing. The list is read the first time a name is hovered, and a slow git is given up on.

Last, a path ending in a line and column, like `a.ts:40:5`, opens the editor at that spot.

The code is on GitHub: finding paths is in [`file-links.ts`](https://github.com/zeikar/vaquita/blob/main/app/src/lib/file-links.ts) and [`path-link-provider.ts`](https://github.com/zeikar/vaquita/blob/main/app/src/lib/path-link-provider.ts), the disk check in [`path-exists.ts`](https://github.com/zeikar/vaquita/blob/main/app/src/lib/path-exists.ts), and the name lookup in [`names.rs`](https://github.com/zeikar/vaquita/blob/main/app/src-tauri/src/names.rs). It all shipped in 0.1.31, which you can get from the [latest release](https://github.com/zeikar/vaquita/releases/latest). If something breaks, an [issue](https://github.com/zeikar/vaquita/issues) helps a lot.
