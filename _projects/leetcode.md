---
layout: project
title: "LeetCode Study"
description: "A LeetCode study log kept as GitHub Discussions and published with Repozine, plus a Claude Code plugin that gives one hint level at a time instead of handing over the answer."
tech_stack: ["Python", "Claude Code plugin", "LeetCode GraphQL", "GitHub Discussions", "GitHub Actions", "Repozine"]
github_url: "https://github.com/zeikar/leetcode"
demo_url: "https://zeikar.dev/leetcode/"
image: "/assets/images/projects/leetcode.png"
sequence: 19
gadget_no: 19
---

A study log that has been running since 2021, and the tool that made it work. Every problem has two halves: a solution file in the repo, and a study note covering what the problem asked, what was tried, what failed, and why the working idea works. The notes are written in Korean and published at [zeikar.dev/leetcode](https://zeikar.dev/leetcode/).

## The log

The notes live in the repo's GitHub Discussions, so writing one is just opening a discussion. [Repozine](/repozine/) builds them into a static site with search and difficulty filters, and redeploys whenever a note or a comment changes.

Two notes-to-code links keep the log honest:

- **The solution must match its note.** A CI check compares each file in `solutions/` against the code block in its discussion and fails if either side went stale.
- **The index is generated, not maintained.** A workflow regenerates the solved-problems table in the README from the notes, so the count and links never drift from what was actually written.

## leetcode-study, the Claude Code plugin

Every AI coding tool is built to finish the problem for you, which is the one thing you don't want when the problem *is* the point. The plugin makes Claude **give one hint level at a time, then stop and wait**:

- **0** — What have you tried? Nothing is given before this is answered.
- **1** — Does the problem say what you think it says?
- **2** — What do the constraints allow?
- **3** — The one observation the rest turns on, put as a question first.
- **4** — Implementation, pseudocode before code.

Topic tags are held back until level 2, because "Dynamic Programming" collapses most of the search space on its own and can't be un-seen. A wrong submission gets the smallest input that breaks it, found by brute-forcing against your own code, rather than a rewritten function. The bug stays yours to find.

A small lookup script resolves a number, slug, URL, or `daily` against LeetCode's GraphQL API in one request.

```
/plugin marketplace add zeikar/leetcode
/plugin install leetcode-study@leetcode-study
```

Recording a solved problem is a separate, repo-local skill: it creates the note before the file so CI never sees an orphan, and drafts in the voice of the notes I wrote by hand, measured against them rather than guessed.
