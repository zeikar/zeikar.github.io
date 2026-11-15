---
layout: project
title: "like-surgeon"
description: "Fix the mismatches between your YouTube Music liked songs and YouTube likes — swapped, duplicated, missing and dead songs — and move likes to the release the artist page lists. A local CLI that writes only what it can prove or you've reviewed."
tagline: "CLI to Fix YouTube Music Liked Songs"
tech_stack: ["Python", "ytmusicapi", "YouTube Data API v3", "SQLite", "SQLAlchemy", "Typer", "Rich"]
github_url: "https://github.com/zeikar/like-surgeon"
demo_url: "https://pypi.org/project/likesurgeon/"
demo_label: "View on PyPI"
image: "/assets/images/projects/like-surgeon.png"
gadget_no: 15
date: 2026-05-05
---

like-surgeon fixes the YouTube Music liked songs that quietly stopped matching my YouTube likes: songs YT Music swapped for another release, songs that show up twice, music it never shows, likes left on videos that no longer exist. It scans YouTube Music and YouTube into SQLite, keeps every scan as a snapshot (the backup YouTube Music doesn't offer), works out which YouTube like is behind each song, and fixes only what it can prove. Since 0.13 it can also move a like to the release an artist's page lists, after I review the matches. It's on PyPI as `likesurgeon`.

## Liked songs is a view, not a second list

Up to 0.10 the tool treated YouTube's Liked videos and YT Music's Liked songs as two lists that drift apart, and matched them by title. One relinked song then surfaced as several different findings, and fixing one moved the song into another. The model that replaced it: YouTube Liked videos is the only place likes are stored. YT Music's Liked songs renders that list in the same order, leaves out what it doesn't show, and may play each entry as a different video than the like behind it. A relink isn't YT Music moving your like to a new track; it's the old like *shown as* the new one. Music videos shown as their audio track, and songs listed twice, follow from the same rule. Before the redesign I had already checked it by hand on 27 re-points and shadow removals in my own library.

[![A diagram with YouTube Liked videos on the left and YT Music Liked songs on the right, lined up row by row. Song 1 is shown as itself. A dead old upload of Song 2 is shown as its new release, and like-surgeon re-points the like. A liked music video of Song 3 is shown as the audio track, which is also liked, so the song appears twice. A cover that plays fine is not shown and can be re-liked, opt-in. A deleted video is not shown at all and is only reported.](/assets/images/projects/like-surgeon-how-it-works.webp)](/assets/images/projects/like-surgeon-how-it-works.webp)

## Order is the only link

YT Music never says which like backs an entry; its feedback tokens are opaque. What it does keep is order: in my library, all 1,142 non-duplicate Liked songs entries sit in the same order as Liked videos, where a shuffled list would keep about 62. So `compare-likes` lines the two lists up by position. Entries whose video is itself liked on YouTube become anchors, trimmed to the longest increasing subsequence of their positions, since a greedy pass collapsed on real data. Between anchors the leftover entries pair up in order, but only when both sides have the same count; every other gap is reported and left alone. Titles never decide a pair. They only show up in a same-recording check (duration within 3 seconds, plus the same channel or overlapping titles) before a repoint.

## Three writes, each checked against the whole list

`sync` makes three kinds of change, all on YouTube. A *repoint* likes the playable track, confirms the rating, then unlikes the dead original and confirms again. An *unlike shadow* removes the extra like that made a song appear twice. Both leave a like on a video that still plays alone unless `--include-playable` is passed. After each one it re-reads the entire Liked songs list: a repoint must leave it unchanged, an unlike must remove exactly one copy. If the list doesn't match, it reads again 15 seconds later, then re-likes the original, undoes any like it added, and stops the run, because a mismatch means the alignment itself may be wrong. Every write is recorded in SQLite as it happens, so an interrupted run still shows what it left behind.

The third, added in 0.12, is opt-in. A *relike* unlikes and re-likes a video that looks like music but that YT Music never shows, which gives YT Music another chance to list it. A re-like moves the video to the top of both lists, so it works oldest first. Its check expects nothing removed and at most one entry added; anything else stops the run. I tried it by hand before building it: of 26 such videos, 18 showed up in Liked songs and nothing else moved.

It never presses YT Music's own like button. That button sets the same rating as YouTube's: liking appends a duplicate entry, and un-liking can take the YouTube like with it.

## Moving a like to the release the artist page lists

A song often exists as several identical audio tracks: the single, the album, a best-of. A like belongs to one of them, so a song I'd liked from a compilation showed up unliked in the artist's Top songs. `canonicalize`, added in 0.13, is a separate command for that, because nothing here is broken. The two lists already agree, so order can't help either. It is the one place titles pick what gets written: a liked audio track that neither the artist's "Show all" list nor Top songs carries, and exactly one track in the "Show all" list with the same normalized title and a length within a second. Length alone isn't enough; one artist list carries a song at 316 s and its instrumental at 317 s. The liked track's album name with Version, Live or Remix in it keeps a match report-only until I opt in with `--include-flagged`, and `skip` drops the ones I disagree with.

The move is `sync`'s repoint, with the same whole-list check, here expecting one entry swapped for the other. If the listed track is already liked, the song was liked twice under two releases, and only the extra like goes. In my library that was 71 likes across 314 artist pages, 7 of them duplicates `compare-likes` had no way to see.

Artist pages turned out to be the fragile part: ytmusicapi's `get_artist` broke on a fifth of my artists, and YT Music sometimes drops the Top songs shelf from the response, so the tool parses the page itself and treats a missing song list as unreadable instead of empty ([Liked, but Not on the Artist Page](/blog/liked-but-not-on-the-artist-page/)).

## What stays manual

Likes on unavailable videos that YT Music doesn't show at all are reported, not removed: a region block can lift, and an unlike would lose the like for good. Deleted videos have a quirk of their own. The YouTube Data API returns 404 when you try to unlike one, while YT Music's rating call still removes it, so the README documents that path for cleaning up by hand. Some likes never reach a scan at all: an old like, mostly on a video marked made for kids, can stay in Liked videos while the API leaves it out, so `scan youtube-likes` warns when YouTube's own count is higher than what it read.

The 0.11 redesign went through [hyperclaude](/projects/hyperclaude/), with Codex reviewing the diff over six rounds before it merged. After the cleanup, every one of the 1,172 songs in my Liked songs is backed by its own YouTube like.
