---
layout: project
title: "Backend Interview Guide"
description: "Korean backend interview guide organized across database, cloud, system design, and programming, drafted and reviewed with Codex, Claude Code, and an agent harness."
tech_stack: ["Codex", "Claude Code", "Agent Harness", "Markdown", "Python", "GitHub"]
github_url: "https://github.com/zeikar/backend-interview-guide"
demo_url: "https://zeikar.dev/backend-interview-guide/"
sequence: 12
gadget_no: 6
---

A Korean-language knowledge base for backend interviews — built because solid mid-to-senior interview material in Korean is genuinely hard to find. It's Markdown-first and organized for prep, not flashcards: each topic is about explaining trade-offs out loud, not memorizing a definition.

## What's covered

Four categories, 69 topic documents in total:

- **Database** (17) — modeling, transactions, caching, NoSQL, optimization
- **Cloud** (20) — Kubernetes, serverless, networking, security, ops automation
- **System Design** (21) — scalability, load balancing, multi-tenancy, security design
- **Programming** (11) — languages, data structures, algorithms, concurrency, testing

## How it was written

This was also an experiment in agent-assisted writing at scale: I used Codex, Claude Code, and an agent harness to draft and review documents in parallel, then made a final human pass to flatten the tone and cut weak explanations. The harness behind it — separate writer, reviewer, and consistency-checker agents instead of one all-in-one — is its own write-up: [Three Agents, One Document](/blog/three-agents-one-document/). Keeping 69 docs coherent meant leaning on structure — category indexes, consistent topic boundaries, and a Markdown link checker so navigation doesn't rot as the corpus grows. Licensed CC BY 4.0.
