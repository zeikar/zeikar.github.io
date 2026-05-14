---
layout: project
title: "hyperclaude"
description: "Claude Code plugin that splits the AI coding workflow: Claude builds, Codex critiques. A gated research → plan → review → ship pipeline with skills, agents, commands, and hooks."
tech_stack: ["Node.js 18+", "Claude Code plugin runtime", "codex-cli", "Bash", "git"]
github_url: "https://github.com/zeikar/hyperclaude"
image: "/assets/images/projects/hyperclaude.png"
sequence: 2
---

## Project Overview

hyperclaude pushes Claude Code beyond stock with a deliberate division of labor between two AI coding agents: **Claude is the builder, Codex is the critic**. v0.8 alpha, dogfooded daily.

## Key Features

- **Commands**: `/hyperclaude:hyper-loop <plan>` (unattended plan iteration loop) and `/hyperclaude:hyper-loop-cancel` — argv-bearing explicit-gesture entries
- **Skills**: Codex-backed gates (`hyper-research`, `hyper-plan-review`, `hyper-code-review`, `hyper-docs-review`) plus Claude orchestrators (`hyper-plan`, `hyper-docs-sync`, `hyper-implement`) and implementation discipline (`hyper-tdd`, `hyper-debug`)
- **Agents**: Claude implementation arm — `planner`, `implementer`, `verifier`, `documenter`
- **Hooks**: SessionStart workflow router + `hyper-loop` intake/Stop hooks that bind loop state to a session and drive continuation until the plan's checkboxes are done
- **Codex as Critic, Never Editor**: every Codex invocation is read-only — fresh `codex exec` calls pass `--sandbox read-only`; `codex exec resume` and `codex exec review` (which don't accept the flag) get `-c sandbox_mode=read-only` as a config override
- **Artifact Convention**: `.hyperclaude/{research,plans,plan-reviews,code-reviews,docs-reviews,loops}/` with timestamped slugs that link a research → plan → plan-review trio end-to-end
- **Zero npm dependencies**: Node 18+ stdlib only, plus `codex-cli ≥ 0.130.0` and `git` on PATH

## Technical Challenges & Solutions

### Challenge 1: Splitting cost between two agents without coupling them
Designed each gate as a command/skill pair so Codex critiques can be invoked anywhere in the workflow without baking Codex into Claude's agent layer. The `.hyperclaude/` directory is the only shared interface.

### Challenge 2: Keeping Codex bounded to review
Pinned every Codex invocation to read-only: fresh `codex exec` (research / plan-review / docs-review) uses `--sandbox read-only`; `codex exec resume` and `codex exec review` (which don't accept the flag) get an explicit `-c sandbox_mode=read-only` config override. The bridge's argv is minimal and auditable, and Codex never authors a patch.

### Challenge 3: Code-to-doc traceability
`hyper-docs-sync` reads a `Code | Docs` mapping table from the consumer project's `CLAUDE.md` / `AGENTS.md` and dispatches targeted updates per affected doc, falling back to a heuristic when no table exists.

### Challenge 4: Unattended plan iteration without losing session safety
`/hyperclaude:hyper-loop` binds loop state to the current session via a `UserPromptExpansion` intake hook and re-fires `hyper-implement` from a Stop hook until every checkbox in the plan is `[x]` or `--max` is reached. State files live under `.hyperclaude/loops/`, one per session × slug.

## What I Learned

- Wiring multi-agent workflows around a single plugin runtime without an MCP layer
- Designing commands, skills, agents, and hooks that compose into a research → plan → implement → review cycle
- Keeping bridges between AI tools small and auditable — argv stays minimal so the trust boundary is obvious
- Driving session-scoped automation with `UserPromptExpansion` + Stop hooks instead of a long-running daemon

## Impact

hyperclaude is the workflow I now use daily. Open-source so others can fork the conventions instead of rebuilding the wiring.
