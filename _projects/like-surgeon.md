---
layout: project
title: "like-surgeon"
description: "Local-first CLI that scans, diffs, and diagnoses your YouTube Music and YouTube liked songs — region-aware ghost detection, metadata drift, cross-source matching."
tech_stack: ["Python 3.11+", "uv", "SQLite", "ytmusicapi", "YouTube Data API v3", "RapidFuzz"]
github_url: "https://github.com/zeikar/like-surgeon"
sequence: 4
---

## Project Overview

like-surgeon syncs, backs up, and (eventually) repairs your YouTube Music liked songs. MVP 0.3.1 — read-only scanner across YouTube Music *and* YouTube, with cross-source diagnosis, region-aware ghost detection, and metadata drift. **Local-first. No server, no destructive actions.**

## Key Features

- **Dual-source Snapshots**: Authenticates with YouTube Music (`ytmusicapi`, browser-header) and YouTube Data API v3 (Google OAuth), snapshots both into a local SQLite database. Point-in-time metadata is frozen on each `SnapshotItem` — a later rename doesn't rewrite history.
- **Cross-source Matching**: `compare-likes` runs a three-stage match — `video_id` → `canonical_key` → RapidFuzz fuzzy on `title | artists` — and persists each run as a `Diagnosis` with per-finding rows.
- **Ghost Detection**: Detects deleted, private, region-blocked, and otherwise unavailable YouTube likes at scan time via `videos.list?part=status,contentDetails`. Region-blocked surfaces only when the user sets an ISO 3166-1 alpha-2 region in `config.json`.
- **Metadata Drift**: Diffs title and artists between snapshot pairs so silent provider-side renames surface as `metadata_drift` findings.
- **Music Classifier**: Heuristics on YouTube likes — `- Topic` channels, "Provided to YouTube by …", `artist - title` patterns, negatives like `vlog`, `tutorial`, `gameplay`.
- **Auth UX**: `auth ytmusic --from-browser chrome` reads YT Music cookies straight from a logged-in browser via `browser-cookie3` and writes a ytmusicapi-compatible `browser.json` (POSIX mode `0o600`). Manual paste flow stays as a fallback.

## Technical Challenges & Solutions

### Challenge 1: ytmusicapi OAuth dead-end
Explored ytmusicapi OAuth (Device Code) to escape browser-header cookie staleness — abandoned in 0.2.1 because ytmusicapi 1.12 + Google's current backend reject every non-TV `clientName` for OAuth-issued tokens, and TV clients return YouTube-shape responses ytmusicapi can't parse. Salvaged a `fetch_liked_songs` parse-error boundary so stale auth surfaces as a clean re-auth hint instead of a traceback.

### Challenge 2: Region-blocked ghosts without extra quota
Folded `regionRestriction` checking into the existing `videos.list` call by widening `part=status` to `part=status,contentDetails`. `videos.list` is 1 quota unit regardless of `part=` selection, so ghost detection got region-awareness for free.

### Challenge 3: Heuristic classification without false certainty
Treated `compare-likes` output as a *starting point* for review, not a verdict — nothing is mutated on the user's behalf. The 0.4 milestone introduces write actions only after the read side is trusted.

## What I Learned

- Designing a local-first CLI around a SQLite snapshot model where every scan is immutable history
- Working around community-maintained API constraints (ytmusicapi) while keeping the official API (YouTube Data API v3) as the source of truth where it matters
- Three-stage matching (exact → canonical → fuzzy) as a practical pattern for reconciling music libraries across providers

## Impact

A personal tool that turns "are my YouTube Music likes actually safe?" into a question with a real answer. Roadmap: write actions for cross-source like sync (0.4) → local web UI (1.0).
