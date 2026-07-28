---
layout: project
title: "hyperclaude"
description: "Claude Code plugin that splits the AI coding workflow: Claude builds, Codex critiques. A gated research → plan → review → ship pipeline with skills, agents, commands, and hooks."
tech_stack: ["Node.js 18+", "Claude Code plugin runtime", "codex-cli", "Bash", "git"]
github_url: "https://github.com/zeikar/hyperclaude"
demo_url: "https://zeikar.dev/hyperclaude/"
image: "/assets/images/projects/hyperclaude.png"
sequence: 2
gadget_no: 16
---

## Project Overview

hyperclaude pushes Claude Code beyond stock with a deliberate division of labor between two AI coding agents: **Claude is the builder, Codex is the critic**. It wraps a gated research → plan → review → implement → review → ship pipeline, with autonomous multi-agent revise loops that self-converge. v0.14 alpha, dogfooded daily.

## Key Features

- **Commands**: `/hyperclaude:hyper-setup` — a local prerequisite doctor that probes Node/codex-cli/git and never spawns Codex or agents (the only command; everything else is description-triggered)
- **Skills**: Codex-backed gates (`hyper-research`, `hyper-plan-review`, `hyper-code-review`, `hyper-docs-review`), Claude orchestrators (`hyper-plan`, `hyper-docs-sync`, `hyper-implement`), autonomous loops (`hyper-plan-loop`, `hyper-implement-loop`), and implementation discipline (`hyper-tdd`, `hyper-debug`)
- **Agents**: Claude implementation arm — `planner`, `implementer`, `verifier`, `documenter`, `researcher`, `fixer`
- **Autonomous revise loops**: `hyper-plan-loop` and `hyper-implement-loop` spawn a persistent Claude teammate (planner / fixer) that revises while Codex stays the reviewer, looping until Codex returns no blocking findings or a hard cap is hit — built on Claude Code's experimental agent-teams
- **Hooks**: a SessionStart hook that injects a workflow router plus an optional `.hyperclaude/` artifact snapshot footer
- **Codex as Critic, Never Editor**: every Codex invocation is read-only — fresh `codex exec` (research / plan-review / code-review / docs-review) passes `--sandbox read-only`; `codex exec resume` (which doesn't accept the flag) gets `-c sandbox_mode=read-only` as a config override
- **Artifact Convention**: `.hyperclaude/{research,plans,plan-reviews,code-reviews,docs-reviews}/` with timestamped slugs that link a research → plan → plan-review trio end-to-end
- **Zero npm dependencies**: Node 18+ stdlib only, plus `codex-cli ≥ 0.130.0` and `git` on PATH

## Technical Challenges & Solutions

### Challenge 1: Splitting cost between two agents without coupling them
Designed each gate as a self-contained skill so Codex critiques can be invoked anywhere in the workflow without baking Codex into Claude's agent layer. A single thin bridge script is the only Codex-spawning code, and the `.hyperclaude/` directory is the only shared interface.

### Challenge 2: Keeping Codex bounded to review
Pinned every Codex invocation to read-only: fresh `codex exec` calls pass `--sandbox read-only`; `codex exec resume` (which doesn't accept the flag) gets an explicit `-c sandbox_mode=read-only` config override. The bridge's argv is minimal and auditable, and Codex never authors a patch — even code review is a plain read-only `codex exec` with a review prompt, not a write-capable mode.

### Challenge 3: Code-to-doc traceability
`hyper-docs-sync` reads a `Code | Docs` mapping table from the consumer project's `CLAUDE.md` / `AGENTS.md` and dispatches targeted updates per affected doc, falling back to a heuristic when no table exists.

### Challenge 4: Autonomous revise loops that stay convergent
`hyper-plan-loop` / `hyper-implement-loop` spawn a Claude teammate **once** and reuse its retained context across rounds: the teammate revises, the Codex bridge re-reviews, and the loop repeats until no blocking findings remain or a review cap is reached. The reviewer is always the bridge, never a teammate — preserving the builder/critic split — and a strict reply contract plus teardown protocol keep the multi-agent loop from stalling. The dogfooded failure modes that grew that contract into a 300-line protocol are their own write-up: [How my agent-team revise loop earned a 300-line protocol](/blog/revise-loop-protocol/).

## What I Learned

- Wiring multi-agent workflows around a single plugin runtime without an MCP layer
- Designing skills, agents, commands, and hooks that compose into a research → plan → implement → review cycle
- Keeping bridges between AI tools small and auditable — argv stays minimal so the trust boundary is obvious
- Driving convergent automation with persistent agent-teammates and a hard-capped review loop instead of a long-running daemon

## Impact

hyperclaude is the workflow I now use daily — including building and shipping this very page through its own plan and implement loops. Open-source so others can fork the conventions instead of rebuilding the wiring.
