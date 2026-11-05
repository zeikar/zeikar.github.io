---
layout: project
title: "Traffolio"
description: "GitHub template that keeps your traffic history past GitHub's 14-day window: a daily Actions run stores views and clones as JSON in your own private repo and draws the dashboard in its README."
tagline: "GitHub Traffic History Beyond 14 Days"
tech_stack: ["TypeScript", "Node.js", "GitHub Actions", "GitHub REST API", "SVG", "Zod", "Vitest", "GitHub Pages"]
github_url: "https://github.com/zeikar/traffolio"
demo_url: "https://zeikar.dev/traffolio-demo/"
image: "/assets/images/projects/traffolio.png"
gadget_no: 29
date: 2026-10-28
---

GitHub's Traffic API only returns the last 14 days of views and clones, so anything older is gone. Traffolio is a template that keeps it: create a private copy and add one fine-grained token with Administration: Read. A daily workflow then collects traffic for the repositories your account owns (public, non-fork ones by default, filtered in `traffolio.config.yml`), plus star and fork history, top referrers and pages, and release downloads. There's no server and no database. The history is JSON committed to that repository, and the run rewrites a dashboard between two markers in its README, with SVG charts and a 30-day sparkline per repository. The [live demo](https://zeikar.dev/traffolio-demo/) is a public instance tracking Traffolio itself.

`npm run dashboard` turns a clone into a single HTML file with period switching, per-repository charts, star history and release downloads. It loads nothing external, so the data never leaves the machine.

## A window that moves

Each run fetches the full 14-day window again and upserts it by repository ID and UTC date, so a re-run never double-counts and a renamed repository keeps its history. The window doesn't end where you'd expect. Measured live across 51 repositories, it ended one or two days before the run, and on different days for different repositories, so Traffolio takes each window from the response instead of assuming it. The dashboard's "data through" date is the earliest window end among the repositories that succeeded, so a repository that's a day ahead doesn't make the rest look like they're missing a day.

Files have a fixed key order and carry no run timestamp. A same-day re-run that gets the same answers from GitHub produces no diff, and the workflow makes no commit.

## Missing is not zero

A day stored as zeros means GitHub reported zero. A date without a key, after a repository's first stored day, is missing: a failed run, no permission, or a gap longer than 14 days. Before that first day it's not tracked yet, so a 30-day total for a repository collected for 14 days covers those 14 days without a warning. Missing days show as `—` and are never summed as zero or interpolated.

The same care runs through the other numbers. Unique visitors are stored per day but never added across days or repositories, so there's no "monthly unique visitors" to get wrong. Referrers are rolling 14-day top-10 lists, kept as one snapshot per run date and never added together. Release downloads are cumulative counts, so the downloads shown for a day are the increase since the previous snapshot; a drop from deleted assets counts as zero, and checksum and updater files like `latest.yml` or `*.sha256` aren't counted as downloads.

## Fail closed

Traffic numbers and the whole Git history become public the moment the repository does, so every run checks Traffolio's own visibility with `GET /repos/{repo}` rather than trusting the event payload. A public repository without `public_mode: true`, or one whose visibility can't be read, collects and commits nothing. The token never appears in data, logs, the run summary or the charts.

Exit codes separate three outcomes: 1 when nothing was written, 2 when some repositories hit transient errors and the rest were committed, and 0 for a clean run. A partial run still fails on purpose, so GitHub's failure email prompts a re-run before the missed days fall out of the 14-day window. A missing or expired token stops the run with exit 1.

Publishing is a separate repository with `public_mode: true`, which is how the demo runs. It refuses `include_private`, and stops before collecting if its `data/index.json` already lists a private repository. If a tracked repository later turns private, its entry keeps its old public metadata, only marked missing, so the dashboard doesn't reveal the change or its new name. With `pages: true` the dashboard goes to GitHub Pages too, but only from public mode: on a personal account a Pages site is public even when the repository isn't.

## Star history without the stargazer list

Star history first came from the stargazer list and its `starred_at` dates. That endpoint now needs Contents: write for fine-grained tokens and, since July 2026, lists stargazers only to admins and collaborators, so with the recommended read-only token it returned 403 for every repository. Traffolio switched to `/stargazers/history`, which returns stars per day of each week back to the repository's first week and needs only Metadata: Read. It holds no usernames, and nothing Traffolio stores does either. The history endpoint's day boundaries aren't UTC, so compared against `starred_at` a single star could land on an adjacent day while the weekly totals matched. The whole history is fetched again on every run, because an unstar plus a new star leaves the count unchanged while the dates move.
