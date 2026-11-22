---
title: "Clicking Paths in Claude Code's Terminal Output"
subtitle: "Claude Code prints paths in a colour of their own, splits long ones over two lines, and sometimes starts them with a shell variable or gives just a file name. Making them clickable came down to guessing from the screen, checking the guess on disk, and linking nothing when in doubt."
date: 2026-11-22
unit: vaquita
lang: en
translations:
  ko: /blog/ko/terminal-path-links/
description: "How vaquita makes paths Claude Code prints in an xterm.js terminal ⌘-clickable: colour bounds, rejoining split lines, a disk check, shell variables from the same command, and bare file names that match one file."
---

I'm building [vaquita](/projects/vaquita/), a macOS app for running coding agents like Claude Code and Codex side by side. Agents keep printing things like "updated `app/src/lib/term-view.ts`", and I wanted a ⌘-click on that path to open the file in a tab inside the app.

I thought one regex would do. Some paths do come as real links, but most of what an agent writes is plain text, and a terminal keeps only the characters and their colours. Nothing on the screen says where Claude Code meant a path to start and end.

## Finding paths from the screen alone

Claude Code draws code in backticks in a colour of its own. Korean puts particles right after a word with no space, so a line like "`~/.zshrc`를 만듭니다" ("I'll create ~/.zshrc") has 를 stuck to the path. Cutting where the colour changes leaves just the path. I tried trimming Korean particles by rule first, and dropped it as too fiddly.

Claude Code also breaks long paths onto the next line itself and indents the rest. To the terminal those are two unrelated lines. When the line above reaches the right edge without already ending in a file extension, and the next one starts after an indent, the two are joined and tried as one path.

## Guess, then ask the disk

All of that is guessing from the shape of the screen, so it's sometimes wrong. At first the app underlined whatever looked like a path and only said "no such file" after a click. I'd held off checking the disk because it sounded expensive, but text like `"$S/battle_b_frames.png"` kept getting underlined and then failing to open, so the check went in.

It turned out to be cheap. It only asks whether a path exists (a stat, no reading), and only for the row under the pointer, in one call for that row's paths. A "no" is forgotten after a few seconds, so a file an agent has just written gets its underline soon after. If the answer is slow, the path is underlined as before, and a dead network drive can't hang the app.

With the disk as a backstop, bolder guesses became safe to try. A guess that names no file is simply not found, and the guessed paths below link only once the disk says yes.

## Shell variables

Claude Code sometimes runs a command like this:

```
B=/tmp/example/scratchpad && S=$B/party && ls "$S/a.png"
```

A click on `$S/a.png` should open `/tmp/example/scratchpad/party/a.png`. The app looks for `S=` in the same command, fills in its value, and fills in the `$B` inside that value the same way.

Nothing on the screen marks where a command starts. Claude Code wraps long commands at word boundaries, so if a line's first word would have fit at the end of the line above, it's a new line, not a wrapped one. That's how the app finds where the command begins.

My first version tried to follow more of the shell's syntax: `$` stays literal in single quotes, `S=` inside quotes doesn't count, quotes inside `$(...)` are tracked. Every review round found another case it got wrong. A line like `T="$(printf '%s' '"')"` is enough to throw the quote tracking off. And a file existing on disk doesn't mean it's the file the command meant, so a misread quote would open the wrong file.

Now a variable is filled in only when `NAME=` appears exactly once in the command and there's no `$(`, backtick or single quote anywhere in it. Anything doubtful links nothing. Handing the text to a real shell would be simpler, but terminal output is untrusted input, and one `S=$(rm -rf ~)` would delete your home folder.

One caveat: current Claude Code hides a finished Bash call behind a single "Ran 1 shell command" line. So in Claude Code this helps in the expanded view (⌃O) or while a command is still running; in a shell or a Codex session it just works.

## Bare file names

Agents often write just `path-link-provider.ts`. Looking only in the folder the session started in finds the files right there and little else. So the app reads the repo's file list with `git ls-files`, new files not yet committed included, and links a name only when exactly one file in the repo has it. A name like `index.ts`, shared by several files, links nothing. The list is read the first time a name is hovered, and if git takes too long the app gives up and links no names.

Finally, a path ending in a line number, like `a.ts:40` or `a.ts:40:5`, opens the editor at that spot.

The code is on GitHub: finding paths is in [`file-links.ts`](https://github.com/zeikar/vaquita/blob/v0.1.31/app/src/lib/file-links.ts) and [`path-link-provider.ts`](https://github.com/zeikar/vaquita/blob/v0.1.31/app/src/lib/path-link-provider.ts), the disk check in [`path-exists.ts`](https://github.com/zeikar/vaquita/blob/v0.1.31/app/src/lib/path-exists.ts), and the name lookup in [`names.rs`](https://github.com/zeikar/vaquita/blob/v0.1.31/app/src-tauri/src/names.rs). It all shipped in 0.1.31, which you can get from the [latest release](https://github.com/zeikar/vaquita/releases/latest). If something breaks, an [issue](https://github.com/zeikar/vaquita/issues) helps a lot.
