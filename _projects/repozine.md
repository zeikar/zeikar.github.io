---
layout: project
title: "Repozine"
description: "Static site generator that publishes GitHub Issues or Discussions as an Astro-built GitHub Pages site, started (as Issueage) as the original engine behind my personal portfolio."
tech_stack: ["Astro", "React", "Tailwind CSS", "GitHub GraphQL API", "GitHub Actions", "Pagefind"]
github_url: "https://github.com/zeikar/repozine"
demo_url: "https://zeikar.dev/repozine/"
sequence: 16
gadget_no: 1
---

Repozine treats GitHub Issues (or Discussions) as a CMS: write content as issues, and it builds a static Astro site from them and publishes it to GitHub Pages. No database, no separate authoring tool — the issue tracker *is* the editor.

## How you use it

Create a repo from the template (or graft it onto an existing one), edit `config.json`, push, and set GitHub Pages to deploy from GitHub Actions. The workflow pulls your issues or discussions through the GitHub GraphQL API at build time, renders them into static pages with search, and redeploys when posts or their comments change.

It started as Issueage, the original engine behind this very portfolio before the rewrite to Jekyll — an early experiment in bending GitHub's own primitives (Issues, Actions, Pages) into a complete publishing pipeline — and was later rebuilt on Astro and renamed.
