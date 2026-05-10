---
layout: project
title: "Backend Interview Guide"
description: "Korean backend interview guide organized across database, cloud, system design, and programming, drafted and reviewed with Codex, Claude Code, and an agent harness."
tech_stack: ["Codex", "Claude Code", "Agent Harness", "Markdown", "Python", "GitHub"]
github_url: "https://github.com/zeikar/backend-interview-guide"
demo_url: "https://zeikar.dev/backend-interview-guide/"
sequence: 10.5
---

## Project Overview

Backend Interview Guide is a Korean knowledge base for backend developer interviews. It is structured as a Markdown-first repository covering database, cloud, system design, and programming topics for real interview preparation rather than short Q&A snippets.

## What Makes It Different

- **Agent-driven writing workflow**: I used Codex, Claude Code, and an agent harness to draft, review, and refine documents in parallel.
- **Structured coverage**: The repository currently spans 4 categories and 33 topic documents, with category indexes that keep the content navigable.
- **Interview-oriented writing**: Each document focuses on how to explain trade-offs clearly in an interview, not just how to memorize definitions.

## Content Scope

- **Database**: scaling, optimization, transactions, caching, Redis, NoSQL, MongoDB
- **Cloud**: container, Kubernetes, serverless, microservices, gRPC, service mesh, logging/monitoring
- **System Design**: scalability, load balancing, high availability, API design, distributed systems, event-driven architecture, security
- **Programming**: JavaScript, Go, data structures, algorithms, concurrency

## Technical Challenges & Workflow

### Challenge 1: Keeping a large Markdown repo coherent
The repository is split into category indexes and topic documents, so content quality depends on consistent structure, cross-linking, and topic boundaries.

### Challenge 2: Making agent output production-ready
Parallel drafting is fast, but raw output is not enough. I used a review loop to normalize tone, remove weak explanations, and keep the final material interview-usable.

### Challenge 3: Scaling content without losing maintainability
The repo includes runtime-discoverable category rules and a Markdown link checker so the documentation can keep growing without breaking navigation.

## What I Learned

- How to use multiple coding agents for content production without letting quality drift
- How to turn backend topics into concise interview explanations with explicit trade-offs
- How to design a documentation repo so agent workflows remain repeatable as the corpus grows

## Impact

This project shows not only backend knowledge organization, but also how I build practical agent-assisted workflows with Codex, Claude Code, and harness-based parallel review.
