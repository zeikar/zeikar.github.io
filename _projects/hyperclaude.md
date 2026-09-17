---
layout: project
title: "hyperclaude"
description: "Claude Code plugin where Claude plans and writes the code and Codex reviews it read-only, looping until Codex has nothing blocking left."
tech_stack: ["Claude Code plugin", "Codex CLI", "Node.js", "git"]
github_url: "https://github.com/zeikar/hyperclaude"
demo_url: "https://zeikar.dev/hyperclaude/"
image: "/assets/images/projects/hyperclaude.png"
sequence: 2
gadget_no: 16
---

hyperclaude runs a coding task through a fixed division of labor: Claude is the builder, Codex is the critic. Claude researches, plans, writes the code and updates the docs. Codex reviews the plan, the diff and the docs. Small changes skip the steps they don't need, but a behavior change always gets a code review. I run my own projects through it.

## Codex reviews, never edits

Every Codex call goes through one Node bridge script, the only part of the plugin that starts Codex, and every call is pinned to a read-only sandbox. A fresh `codex exec` gets `--sandbox read-only`. `codex exec resume` doesn't accept that flag, so it gets `-c sandbox_mode=read-only` instead. Codex can read the repo and search the web, but it can't write a patch: code review is a review prompt, not a write-capable mode. Each review lands as a Markdown file under `.hyperclaude/` for the next step to pick up. The plugin has no npm dependencies.

## Loops that stop on their own

The plan, implement and docs loops run review → revise without me. Claude's agent in each loop is spawned once and keeps its context between rounds, and Codex resumes its own review thread. After each review the loop sorts findings by what they say, not by the severity label Codex attached. Correctness bugs, security holes, broken tests and missing behavior block, and so do wrong file paths or task order in a plan. Style and nits get reported but never start another round. The loop ends when a review has nothing blocking, or at a cap on review rounds.

What made plans converge came out of measuring round counts. The longest-running plans were 40–47% preamble, including sections that existed only to answer the previous review, and those drew new findings of their own. The one that converged cleanly was 12%. The planner now keeps a plan to a task list and re-reads whatever a finding cites before editing. Codex also kept flagging things I had asked for as scope creep, because it never saw the conversation, so reviews now carry a short brief of what was requested.

## The protocol a measurement deleted

The first loops kept Claude's agent alive as an agent-teams teammate that talked to the orchestrating session through a mailbox, and during a multi-minute Codex review that mailbox raced. Replies from the previous round came back, and idle notifications arrived a round late. Each fix added state: request-id counters, send timestamps, a message classifier, a degrade layer. I wrote it up as [How My Agent-Team Revise Loop Earned a 300-Line Protocol](/blog/revise-loop-protocol/).

Three months later a loop burned through a 5-hour usage limit far faster than a normal session. Cross-tabbing 434 local transcripts traced it to one parameter. Spawning the agent with `name:` made it a team member, and Claude Code then dropped the plugin's agent definition, re-attached a skill listing every round and invalidated the prompt cache, so cost grew quadratically with the number of rounds. Without `name:` there is no team and no mailbox, which left most of the protocol with nothing to route. The shared protocol file went from 192 lines to 39: [My 300-Line Agent Protocol Was Working Around One Parameter](/blog/protocol-working-around-a-bug/).
