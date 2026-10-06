---
layout: project
title: "like-surgeon"
description: "Local-first CLI that backs up your YouTube Music liked songs, finds relinked, duplicate and dead likes, and fixes the ones it can prove."
tech_stack: ["Python", "ytmusicapi", "YouTube Data API v3", "SQLite", "SQLAlchemy", "Typer", "Rich"]
github_url: "https://github.com/zeikar/like-surgeon"
demo_url: "https://pypi.org/project/likesurgeon/"
demo_label: "View on PyPI"
image: "/assets/images/projects/like-surgeon.png"
sequence: 12
gadget_no: 15
date: 2026-05-05
---

like-surgeon keeps a local backup of my YouTube Music liked songs and repairs the ones that quietly broke: songs YT Music swapped for another release, songs that show up twice, likes on videos that no longer exist. It scans YouTube Music and YouTube into SQLite, keeps every scan as a snapshot, works out which YouTube like is behind each song, and fixes only what it can prove. It's on PyPI as `likesurgeon`.

## Liked songs is a view, not a second list

Up to 0.10 the tool treated YouTube's Liked videos and YT Music's Liked songs as two lists that drift apart, and matched them by title. One relinked song then surfaced as several different findings, and fixing one moved the song into another. The model that replaced it: YouTube Liked videos is the only place likes are stored. YT Music's Liked songs renders that list in the same order, leaves out what it doesn't show, and may play each entry as a different video than the like behind it. A relink isn't YT Music moving your like to a new track; it's the old like *shown as* the new one. Music videos shown as their audio track, and songs listed twice, follow from the same rule. Before the redesign I had already checked it by hand on 27 re-points and shadow removals in my own library.

## Order is the only link

YT Music never says which like backs an entry; its feedback tokens are opaque. What it does keep is order: in my library, all 1,142 non-duplicate Liked songs entries sit in the same order as Liked videos, where a shuffled list would keep about 62. So `compare-likes` lines the two lists up by position. Entries whose video is itself liked on YouTube become anchors, trimmed to the longest increasing subsequence of their positions, since a greedy pass collapsed on real data. Between anchors the leftover entries pair up in order, but only when both sides have the same count; every other gap is reported and left alone. Titles never decide a pair. They only show up in a same-recording check (duration within 3 seconds, plus the same channel or overlapping titles) before a repoint.

## Two writes, each checked against the whole list

`sync` makes two kinds of change, both on YouTube. A *repoint* likes the playable track, confirms the rating, then unlikes the dead original and confirms again. An *unlike shadow* removes the extra like that made a song appear twice. After each one it re-reads the entire Liked songs list: a repoint must leave it unchanged, an unlike must remove exactly one copy. If the list doesn't match, it reads again 15 seconds later, then re-likes the original, undoes any like it added, and stops the run, because a mismatch means the alignment itself may be wrong. Every write is recorded in SQLite as it happens, so an interrupted run still shows what it left behind.

It never presses YT Music's own like button. That button sets the same rating as YouTube's: liking appends a duplicate entry, and un-liking can take the YouTube like with it.

## What stays manual

Likes on unavailable videos that YT Music doesn't show at all are reported, not removed: a region block can lift, and an unlike would lose the like for good. Deleted videos have a quirk of their own. The YouTube Data API returns 404 when you try to unlike one, while YT Music's rating call still removes it, so the README documents that path for cleaning up by hand.

The 0.11 redesign went through [hyperclaude](/projects/hyperclaude/), with Codex reviewing the diff over six rounds before it merged. After the cleanup, every one of the 1,172 songs in my Liked songs is backed by its own YouTube like.
