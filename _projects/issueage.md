---
layout: project
title: "Issueage"
description: "Static site generator that publishes GitHub Issues as a Svelte-rendered GitHub Pages site, started as the original engine behind my personal portfolio."
tech_stack: ["Svelte", "JavaScript", "GitHub Issues", "GitHub Pages", "sirv"]
github_url: "https://github.com/zeikar/issueage"
demo_url: "https://zeikar.dev/issueage/"
sequence: 12
---

## Project Overview

Issueage is a static site generator that turns a GitHub repository's Issues into a Svelte-rendered website published on GitHub Pages. Issues become content entries; the generator builds a small Svelte app and deploys it to the `gh-pages` branch via a template-based workflow.

## Key Features

- **Issues-as-CMS Workflow**: GitHub Issues serve as the content source — no database, no separate authoring UI
- **Svelte Frontend**: The generated site is a small Svelte app with client-side routing and rendering
- **GitHub Pages Deployment**: Publishes to `gh-pages` so any GitHub repo can host the site for free
- **Template-driven Setup**: Bootstrap a new site by creating a repo from the template and editing `config.json`

## Technical Challenges & Solutions

### Challenge 1: Treating Issues as content
Built a fetch and render layer that pulls issues through the GitHub API and shapes them into pages, mapping title, body, and labels into the site's content model.

### Challenge 2: Keeping the build single-purpose
Kept the workflow narrow on purpose: configure once, push, and let the bundled scripts produce a deployable static build for GitHub Pages.

### Challenge 3: Reusable across repos
Designed it as a GitHub template so anyone — including my own portfolio site — could fork it and get a working Issues-driven page without rewriting the build glue.

## What I Learned

- How to repurpose GitHub-native primitives (Issues, Pages) into a complete content pipeline
- How to package a static-site workflow as a reusable template
- How to keep a small, opinionated SSG narrow enough to stay maintainable

## Impact

Issueage was the original engine behind my personal portfolio and an early experiment in turning GitHub itself into a publishing platform.
