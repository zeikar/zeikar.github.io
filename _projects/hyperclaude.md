---
layout: project
title: "hyperclaude"
description: "Claude Code plugin that splits the AI coding workflow: Claude builds, Codex critiques. Skills, agents, slash commands for research → plan → review → implement."
tech_stack: ["Node.js 18+", "Claude Code plugin runtime", "codex-cli", "Bash", "git"]
github_url: "https://github.com/zeikar/hyperclaude"
sequence: 2
---

## Project Overview

hyperclaude pushes Claude Code beyond stock with a deliberate division of labor between two AI coding agents: **Claude is the builder, Codex is the critic**. v0.3 alpha, dogfooded daily — open-sourced as a personal customization project.

## Key Features

- **Slash Commands**: `/hyperclaude:hyper-research`, `hyper-plan-review`, `hyper-code-review`, `hyper-docs-sync`, `hyper-docs-review`, `hyper-implement` — plugin-namespaced per Claude Code's contract
- **Skills**: Codex-backed gates (research / plan-review / code-review / docs-review) plus implementation discipline (`hyper-tdd`, `hyper-debug`) and plan execution (`hyper-implement`)
- **Agents**: Claude implementation arm — `planner`, `implementer`, `verifier`, `documenter`
- **Codex as Critic, Never Editor**: `codex exec` always runs `--sandbox read-only`; `codex review` is a diff-only subcommand. No `-c` overrides, minimal auditable argv
- **Artifact Convention**: `.hyperclaude/{research,plans,reviews,code-reviews,docs-reviews}/` with timestamped slugs that link a research → plan → review trio
- **Zero npm dependencies**: Node 18+ stdlib only, plus `codex-cli ≥ 0.128.0` and `git` on PATH

## Technical Challenges & Solutions

### Challenge 1: Splitting cost between two agents without coupling them
Designed each gate as a slash command + skill pair so Codex critiques can be invoked anywhere in the workflow without baking Codex into Claude's agent layer. The `.hyperclaude/` directory is the only shared interface.

### Challenge 2: Keeping Codex bounded to review
Pinned every Codex invocation to either `codex exec --sandbox read-only` or `codex review` (a subcommand that, by design, analyses diffs and doesn't author patches). No flag overrides bleed through the bridge.

### Challenge 3: Code-to-doc traceability
`hyper-docs-sync` reads a `Code | Docs` mapping table from the consumer project's `CLAUDE.md` / `AGENTS.md` and dispatches targeted updates per affected doc, falling back to a heuristic when no table exists.

## What I Learned

- Wiring multi-agent workflows around a single plugin runtime without an MCP layer
- Designing slash commands and skills that compose into a research → plan → implement → review cycle
- Keeping bridges between AI tools small and auditable — argv stays minimal so the trust boundary is obvious

## Impact

hyperclaude is the workflow I now use daily. Open-source so others can fork the conventions instead of rebuilding the wiring.
