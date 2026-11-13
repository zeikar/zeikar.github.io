---
title: "Why Codex Spawned Sub-Agents in My Code Reviews"
subtitle: "My read-only Codex reviews were quietly forking themselves, and each fork re-billed the whole conversation. The config flag I shipped to stop it was accepted and did nothing. The cause was one section of a rules file I shared with Claude Code."
date: 2026-11-14
unit: hyperclaude
lang: en
translations:
  ko: /blog/ko/codex-sub-agent-spawns/
description: "Codex review sessions spawned forked sub-agents because a shared AGENTS.md asked for delegation. Measured from Codex rollout logs: what the forks cost, why features.multi_agent=false didn't stop them, and the fix at the cause."
---

[hyperclaude](/projects/hyperclaude/) splits a coding task between two agents: Claude Code plans and writes, and Codex reviews, read-only. Every Codex call goes through one bridge script, and each review lands as a Markdown file with Codex's token counts in its front matter.

In September the reviews on [Iki](/projects/iki/) started to feel expensive. Iki has some big files, so long reviews were believable. The review files couldn't settle it, because they didn't record all of the spend.

## Where the tokens went

The bridge only records the session it starts. Codex keeps its own log of every session, though, in `~/.codex/sessions/`, and a session that was spawned by another one names its parent there. Counting September, up to the 20th, by project:

| project | sessions | forked children | input tokens |
|---|---:|---:|---:|
| Iki | 19 | **21** | 48.2M + **29.6M forked** |
| Charivo | 23 | 0 | 61.2M |
| hyperclaude | 10 | 0 | 13.9M |

On Iki, more than a third of the input went to forked children. The worst review recorded 12.73M tokens. Its three children, `/root/fresh_review`, `/root/fix_round_review` and `/root/fit_fix_review`, used another 10.8M, so the real cost was 23.5M, and the review file under-reported it by 46%.

The children were expensive for a specific reason. Codex spawned them with `fork_turns: "all"`, which hands the child the parent's whole conversation so far. Each fork starts by paying again for everything the review had already read.

Two of Iki's 21 children came from an interactive Codex session; the other 19 came from hyperclaude reviews. Iki wasn't the only repo, either: ten review sessions in three other repos forked over the same days. Iki just had the most forks, and the single most expensive review.

## The instruction that asked for it

Codex doesn't spawn sub-agents on a whim. Its base instructions say:

> Do not spawn sub-agents unless the user or applicable AGENTS.md/skill instructions explicitly ask for sub-agents, delegation, or parallel agent work.

So something was explicitly asking. Codex reads a global `~/.codex/AGENTS.md` on every session, and mine was a symlink to my Claude Code `CLAUDE.md`. I had linked them so both agents would follow the same working rules. One section of that file, "Delegate What Pays", tells Claude when to hand work to a sub-agent, and includes "fork when the work needs what you already know". I wrote it for Claude Code's Agent tool. Codex read it as the explicit ask its own instructions were waiting for.

My first idea was to keep the shared file and skip it just for reviews. Codex doesn't allow that. `-c project_doc_max_bytes=0` drops the project's `AGENTS.md` but keeps the global one, `--ignore-user-config` skips `config.toml` and still injects it, and pointing `CODEX_HOME` elsewhere also moves the login and the session store that resumed reviews are looked up in.

## A flag Codex accepted and ignored

So I went for a switch instead. Codex has a `features.multi_agent` flag, `codex -c features.multi_agent=false doctor` accepted it without complaint, and hyperclaude v1.17.1 added it to every Codex call.

Soon after, a review of this website's repo forked anyway: a `/root/review_print` child with 289k input on top of the 532k the bridge recorded. Then I tested properly, with one-shot `codex exec` runs whose prompt asks for a sub-agent outright, and read the session logs back:

| override | spawned? |
|---|---|
| `features.multi_agent=false` | yes, and the prompt Codex sent was byte-identical to a run without it |
| `features.multi_agent_v2=false` | yes |
| `agents.max_depth=0`, `agents.max_threads=1` | yes |
| a developer instruction to work alone | yes, 2 of 2 |
| the model catalog with `multi_agent_version` removed | **no**, 2 of 2 |

The collaboration tools don't come from the feature flag. They come from a per-model field in Codex's model catalog, and they're fixed when a thread is created: a thread started with the tools keeps them when resumed under a patched catalog. Patching the catalog does work. But it would mean a probe on every run, a gate for every review thread started before the patch, and depending on an internal field that a Codex update could rename without any error. v1.17.2 removed the flag, and the bridge went back byte for byte to what it was before.

What I'd skipped in v1.17.1 was the only check that mattered. I confirmed that Codex accepted the setting, not that it changed what Codex did.

## Fixing the trigger

The spawns had one trigger, and it wasn't in hyperclaude. On September 22 `~/.codex/AGENTS.md` stopped being a symlink and became its own file: the shared working rules without the delegation section. The same day I turned the relationship around. `CLAUDE.md` now imports `AGENTS.md` and adds the delegation section on top, so Claude gets the whole thing and Codex never sees that section. The setup lives in my [dotfiles](/projects/dotfiles/).

Since then there have been more than 1,000 `codex exec` sessions on this machine, every hyperclaude review among them, and not one `spawn_agent` call. The only spawns since were in interactive Codex sessions, not reviews.

## What I'd check next time

Count costs from the agent's own logs. The bridge recorded what it started, which looked complete and wasn't. Codex's session logs had the children and their parents all along.

A setting that's accepted isn't necessarily applied. A config key that parses tells you nothing about behavior. The test is to ask for the very thing the setting should prevent, and see whether it still happens.

A shared rules file is read by each agent in its own terms. "Delegate" meant one tool to Claude and a different, more expensive one to Codex. Sharing the rules still seems right to me, but the parts that call a specific tool belong only with the agent that has that tool.
