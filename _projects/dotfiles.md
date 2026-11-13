---
layout: project
title: "dotfiles"
description: "My macOS setup under GNU Stow, mostly Claude Code config: guidelines shared with Codex, custom skills and critic agents, and a status line that tracks Claude and Codex rate limits in one table."
tagline: "macOS Dotfiles & Claude Code Setup"
tech_stack: ["GNU Stow", "Claude Code", "Codex CLI", "Bash", "jq", "zsh", "Homebrew"]
github_url: "https://github.com/zeikar/dotfiles"
image: "/assets/images/projects/dotfiles.png"
gadget_no: 30
date: 2025-02-06
---

dotfiles is the setup every machine of mine starts from: zsh and git config symlinked into `$HOME` by GNU Stow, plus a Brewfile and a macOS defaults script. Most of the repo, and most of its commits, are the Claude Code side: the global `CLAUDE.md`, `settings.json`, my own skills and agents, and the status line. I change it whenever a session teaches me something, so it moves about as often as my projects do.

## One rulebook for Claude and Codex

The general working rules (think before coding, keep it simple, verify before calling it done, search narrowly) live in one file, `~/.codex/AGENTS.md`. Codex reads it as its global instructions. Claude's global `CLAUDE.md` imports the same file with `@` and adds a single Claude-only section on delegation: which work goes to a sub-agent, which model each kind of sub-agent runs on, and that a code change gets a fresh reviewer before it's reported done. Changing a rule once changes it for both agents, and the two can't drift apart.

## A status line with both rate limits

`statusline.sh` turns the JSON Claude Code pipes to it into three lines: model, effort, context gauge, branch and cost on top, then a small table of 5-hour and 7-day limits, one row for Claude and one for Codex.

Claude Code sends its own limits in that JSON; Codex's don't come from anywhere Claude Code knows about. The script starts `codex app-server` in a read-only sandbox, speaks just enough JSON-RPC to call `account/rateLimits/read`, and caches the answer. The fetch takes about a second over the network, so it runs in the background at most every two minutes behind a `mkdir` lock, and the line always renders from the cache. When fetches keep failing, the row says how old its numbers are instead of passing them off as current.

Every field comes out of the input in one `jq` pass, joined with the 0x1f unit separator rather than a tab. Bash collapses adjacent whitespace delimiters, so with a tab one empty field (no worktree, an unset rate limit) shifts every later value into the wrong variable.

## Skills and agents

- **korean-polish** writes and checks Korean that goes out under my name. Its rules sit in `rules.md`, and `corrections.md` keeps the corrections behind them, like the leetcode notes where Claude's drafts averaged 11.6 sentences and mine 5.9. Changing a rule starts from that record.
- **codex-image** runs Codex's image tool from Claude through parallel `codex exec` jobs. Its notes come from real runs: about five jobs at once before the plan starts queueing, `< /dev/null` because a backgrounded job otherwise waits on stdin forever, and `project_doc_max_bytes=0` because one drawing was paying 19,277 tokens to carry a README the image tool never saw. This page's drawer art came out of it.
- **visual-review** and two critic agents split one question into three. visual-review drives the browser and asks whether anything is broken. aesthetic-critic only reads its screenshots and judges craft. usability-critic attempts real tasks and asks whether a person could finish them.

Plan and code review across Codex and Claude is a separate plugin, [hyperclaude](/projects/hyperclaude/), which these settings install.

## Stow, and what writes back

`install.sh` stows each package only after checking for conflicts. A symlink that already points into the repo is fine. Anything else in the way is listed, and with a yes it moves into `~/.dotfiles-backups/<timestamp>/` before `stow --restow` runs. Secrets stay in `~/.zshrc.local`, which the script creates from a template and Git never sees.

Linking Claude Code's config into a repo has one catch: Claude Code writes to those files too. `/model` saves its pick into the tracked `settings.json`. In a session started from `~`, the project settings file and the user settings file are the same file, so removing a project-scope plugin there turns off the user-scope copy as well. `docs/claude-code.md` lists each of these diffs and whether to commit or restore it.
