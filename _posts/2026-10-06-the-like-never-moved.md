---
title: "The Like Never Moved"
subtitle: "From 0.4 to 0.10, like-surgeon patched YouTube Music likes that seemed to jump from a dead upload to its replacement. They never jumped. YT Music was showing my YouTube likes in the same order, and lining the two lists up made most of the patches unnecessary."
date: 2026-10-06
unit: like-surgeon
lang: en
translations:
  ko: /blog/ko/the-like-never-moved/
description: "Why like-surgeon 0.11 dropped title matching: YouTube Music's Liked songs is an in-order rendering of YouTube's Liked videos, so aligning the two lists by position shows which like is behind every song."
---

[like-surgeon](/projects/like-surgeon/) started from a YouTube Music library that had been going wrong for years. Some liked songs had stopped playing. Some had turned into a different release of the same song. A few showed up twice. YouTube keeps its own list of liked videos and YT Music has its Liked songs, so the plan was simple: scan both lists into SQLite, compare them, fix the differences.

That plan rested on a model of how the two lists drift apart, and the model was wrong. This post is about the one that replaced it in 0.11, and why it ended with less code than the patches it replaced.

## The model I started with

Here's how I understood a relink. You like song A. Its license expires or a region block lands, and A stops playing. YT Music quietly creates a replacement track B, a different video, and moves your like from A to B. YouTube never hears about it, so your YouTube likes still hold A.

Everything up to 0.10 was built on that story. The two lists were two stores of likes that drift. `compare-likes` matched them in stages, from exact video ids down to fuzzy matching on titles and artists, and each kind of mismatch got its own fix: re-point a drifted like, unlike a dead one, like a "YT Music only" song on YouTube, remove a duplicate with YT Music's own rating call.

The fixes kept moving the problem somewhere else. Liking B on YouTube to settle a "liked only in YT Music" song made YT Music list B twice. Removing that duplicate with YT Music's rating call took the new YouTube like away too, and the song was back where it started, five times out of five when I checked. The fuzzy matcher paired songs with other versions of themselves at full confidence. One relinked song could surface as four different findings, and the project notes grew a section explaining how.

## The song that disappeared

The clue came during a cleanup run this October. I was re-pointing relinked songs the old way: like B on YouTube, then unlike A. The API answered 2xx for both calls on every pair, yet on 2 of 38 pairs a write hadn't actually happened. On one of them the like on B never landed and the unlike on A did, and the song vanished from YT Music. Re-liking A on YouTube brought it back.

Under my model that couldn't happen. If YT Music had moved my like to B, A's YouTube like should have had nothing to do with B. But the entry showing B disappeared exactly when A's like did, and came back with it. The entry showing B *was* A's like.

## One list, shown twice

The model that fits: YouTube's Liked videos is the only place a like is stored. YT Music's Liked songs isn't a second list. It's a rendering of the first one: the same likes in the same order, minus the ones YT Music doesn't show, each displayed as a playable track whose video can differ from the one you liked. In the code the two lists are LL and LM, after their playlist ids, and the whole model fits in one line: LM is a rendering of LL.

![A diagram with YouTube Liked videos on the left and YT Music Liked songs on the right, lined up row by row. Song 1 is shown as itself. A dead old upload of Song 2 is shown as its new release, and like-surgeon re-points the like. A liked music video of Song 3 is shown as the audio track, which is also liked, so the song appears twice. A deleted video is not shown at all and is only reported.](/assets/images/blog/like-surgeon-how-it-works.webp)

A relink is A's like shown as B. A liked music video can be shown as its audio track, and if you liked the audio track too, the song appears twice. YT Music's own like button sets the same rating as YouTube's: liking a song there creates a YouTube like on that video.

Every quirk of the old model turned out to be ordinary behavior:

- Liking B on YouTube added a second like that also renders as B. Hence the duplicate.
- YT Music's rating call on that duplicate removed B's like, not A's, which undid the fix.
- The "orphaned" entry that YT Music's rating call couldn't remove was A's like. It went away the moment A was unliked.

## Order is the only link

The model needs a way to tell which like is behind each entry, and YT Music doesn't offer one. Every entry carries feedback tokens, but they're opaque. What it does keep is order. In my library, all 1,142 Liked songs entries that show up once and are liked as themselves on YouTube appear in the same order as Liked videos. A random shuffle would keep about 62 in order.

So 0.11's `compare-likes` lines the two lists up by position. Entries whose video is itself liked on YouTube are anchors, and most songs are. Between two anchors sit a few unexplained Liked songs entries and a few unexplained YouTube likes. When the counts match, they pair up in order: the first leftover like is behind the first leftover entry, and so on. When they don't, nothing is paired, and the entries are reported and left alone. One detail took real data to get right: the anchors have to be the longest increasing subsequence of their positions, because picking them greedily collapsed to a few hundred anchors.

Titles no longer pair anything. For pairs they come back in one place only: before a repoint, the two videos must look like the same recording, with durations within 3 seconds and either the same channel or one title containing the other.

During the cleanup, order alignment agreed with 23 of the 24 pairs whose writes I could verify, and it got one pair right that the title-based matching had pinned on the wrong song.

## Two writes and a tripwire

Once the backing is known, the fixes come down to two, both on YouTube:

- **repoint**: A is dead and shown as B, and B isn't liked. Like B, confirm it with `getRating`, unlike A, confirm again.
- **unlike shadow**: A is shown as B while B is liked too. Unlike A, and the song appears once.

The disappearing song is also the failure both of them have to catch. If a pair were wrong, unliking A would remove some unrelated song from YT Music, and nothing in YouTube's response would say so. So after every unlike, `sync` reads the whole Liked songs list again. A repoint must leave every song shown the same number of times, and an unlike shadow must remove exactly one copy of B. If the list still doesn't match on a second read 15 seconds later, A is re-liked, the like a repoint just put on B is undone, and the run stops, because a mismatch means the pairs from that scan can't be trusted.

## What changed in the library, and in the code

Before the redesign I had already tested the model on 27 likes in my library. 0.11's first real run, just before the release, cleared the last two duplicates, a making-of video and a fan upload each shown as an official track I had also liked, and each unlike removed exactly one entry. Every one of the 1,172 songs in my Liked songs is now backed by its own YouTube like.

What the tool can't prove, it reports, like likes on unavailable videos that YT Music doesn't show at all; those I cleaned up by hand. Deleted videos had one more quirk: the YouTube Data API returns 404 when you unlike one, but YT Music's rating call removes the like fine.

The code got smaller than the patched version. The matcher module went from 591 lines to 68, with alignment in a new 218-line module, five sync actions became two, and the gates and guards built to contain fuzzy pairs went with them.

My old fixes did what they were written to do, for a model with two lists. There was only ever one.

like-surgeon is on PyPI (`uv tool install likesurgeon`), and the [design doc](https://github.com/zeikar/like-surgeon/blob/main/docs/design/ll-lm-alignment.md) has the evidence in more detail.
