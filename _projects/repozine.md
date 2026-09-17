---
layout: project
title: "Repozine"
description: "Template that turns a GitHub repository's Issues or Discussions into a static Astro blog, rebuilt and deployed to GitHub Pages by GitHub Actions."
tech_stack: ["Astro", "GitHub GraphQL API", "GitHub Actions", "TypeScript", "React", "Tailwind CSS"]
github_url: "https://github.com/zeikar/repozine"
demo_url: "https://zeikar.dev/repozine/"
image: "/assets/images/projects/repozine.png"
sequence: 12
gadget_no: 1
---

Repozine treats GitHub Issues (or Discussions) as a CMS: write content as issues, and it builds a static Astro site from them and publishes it to GitHub Pages. No database, no separate authoring tool — the issue tracker *is* the editor.

## How you use it

Create a repo from the template (or add it to an existing repo on its own `repozine` branch). Before the first push, set GitHub Pages to deploy from GitHub Actions, and if you publish from Discussions, turn them on and add a category for posts. Then edit `config.json` and push. The workflow pulls your issues or discussions through the GitHub GraphQL API at build time, renders them into static pages, and redeploys when posts or their comments change. My [LeetCode study log](/projects/leetcode/) is built with it.

Search runs over the text of every post, written out at build time, and matches words anywhere rather than only from their start. Korean joins words together, so a search for 복잡도 needs to find 시간복잡도는; a prefix-only index missed most of those.

It started as Issueage, the original engine behind this very portfolio before the rewrite to Jekyll — an early experiment in bending GitHub's own primitives (Issues, Actions, Pages) into a complete publishing pipeline — and was later rebuilt on Astro and renamed.
