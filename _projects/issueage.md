---
layout: project
title: "Issueage"
description: "Static site generator that publishes GitHub Issues as a Svelte-rendered GitHub Pages site, started as the original engine behind my personal portfolio."
tech_stack: ["Svelte", "JavaScript", "GitHub Issues", "GitHub Pages", "sirv"]
github_url: "https://github.com/zeikar/issueage"
demo_url: "https://zeikar.dev/issueage/"
sequence: 16
---

Issueage treats GitHub Issues as a CMS: write content as issues, and it builds a small Svelte site from them and publishes it to GitHub Pages. No database, no separate authoring tool — the issue tracker *is* the editor.

## How you use it

Create a repo from the template (or graft it onto an existing one), edit `config.json`, push, and point GitHub Pages at the `gh-pages` branch. The build pulls your issues through the GitHub API, maps title/body/labels into a content model, and emits a Svelte app served by `sirv`.

It was the original engine behind this very portfolio before the rewrite to Jekyll — an early experiment in bending GitHub's own primitives (Issues, Actions, Pages) into a complete publishing pipeline.
