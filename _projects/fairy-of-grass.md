---
layout: project
title: "Fairy of Grass"
description: "GitHub Actions template that auto-generates daily contributions by creating scheduled empty commits."
tech_stack: ["GitHub Actions", "YAML", "Template Repository", "Automation"]
github_url: "https://github.com/zeikar/fairy-of-grass"
image: "/assets/images/projects/fairy-of-grass.png"
sequence: 15
---

Fairy of Grass keeps a GitHub contribution graph green by committing for you. It's a template repo: a GitHub Actions workflow runs once a day (~12:00 GMT) and pushes an empty commit, which counts as a contribution without pretending to be real work.

## Setup is three steps

1. Create a repo from the template
2. Add one secret — `USER_EMAIL` — so the commit is attributed to you
3. Done; the daily schedule takes it from there

The whole thing is one cron-scheduled Action and a single secret — deliberately tiny, so it's easy to read end-to-end before you trust it with your profile. (Whether you *should* farm your own grass is between you and your contribution graph.)
