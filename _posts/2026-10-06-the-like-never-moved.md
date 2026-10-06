---
title: "The Like Never Moved"
subtitle: "When a song's upload dies, YouTube Music seems to move your like to a replacement. It doesn't. Liked songs is your YouTube likes shown in the same order, and lining the two lists up shows which like is behind every song."
date: 2026-10-06
unit: like-surgeon
lang: en
translations:
  ko: /blog/ko/the-like-never-moved/
description: "YouTube Music's Liked songs is an in-order rendering of your YouTube Liked videos. How like-surgeon lines the two lists up by position to find the like behind each song, and fixes relinked and duplicate likes safely."
---

[like-surgeon](/projects/like-surgeon/) is a command-line tool for a YouTube Music library that has quietly gone wrong: liked songs that stopped playing, songs that turned into a different release, songs listed twice. It scans your YouTube likes and your YT Music Liked songs into SQLite, works out which YouTube like is behind every song, and fixes the ones it can prove. This post is about the model that makes that possible.

## What a relink looks like

When the upload behind a liked song is pulled or blocked in your region, YT Music often keeps the song in your Liked songs and plays it from a different video, usually another release of the same song. It looks as if YT Music moved your like to the new track. Your YouTube likes still hold the old, dead video, so the two lists seem to have drifted apart.

## The song that disappeared

I took that at face value and fixed relinks the obvious way: like the new track B on YouTube, then unlike the dead video A. Out of 38 songs fixed that way, two had a write that silently didn't take, though YouTube answered 2xx for every call. On one, the like on B never landed but the unlike on A did, and the song vanished from YT Music. Re-liking A on YouTube brought it back.

If YT Music had moved my like to B, A's YouTube like shouldn't have mattered. But the entry showing B disappeared exactly when A's like did, and came back with it. The entry showing B *was* A's like.

## One list, shown twice

The model that fits: YouTube's Liked videos is the only place a like is stored. YT Music's Liked songs isn't a second list. It's a rendering of the first one: the same likes in the same order, minus the ones YT Music doesn't show, each displayed as a playable track whose video can differ from the one you liked. In the code the two lists are LL and LM, after their playlist ids, and the whole model fits in one line: LM is a rendering of LL.

![A diagram with YouTube Liked videos on the left and YT Music Liked songs on the right, lined up row by row. Song 1 is shown as itself. A dead old upload of Song 2 is shown as its new release, and like-surgeon re-points the like. A liked music video of Song 3 is shown as the audio track, which is also liked, so the song appears twice. A deleted video is not shown at all and is only reported.](/assets/images/blog/like-surgeon-how-it-works.webp)

A relink is A's like shown as B. A liked music video can be shown as its audio track, and if you liked the audio track too, the song appears twice. YT Music's own like button sets the same rating as YouTube's: liking a song there creates a YouTube like on that video.

That explains a couple of things that look like bugs:

- Liking B on YouTube to fix a relink adds a second like that also shows as B, so the song appears twice.
- Un-liking that duplicate in YT Music removes the like on B, the one you just added, and you're back where you started.

## Order is the only link

The model needs a way to tell which like is behind each entry, and YT Music doesn't offer one. Every entry carries feedback tokens, but they're opaque. What it does keep is order. In my library, all 1,142 Liked songs entries that show up once and are liked as themselves on YouTube appear in the same order as Liked videos. A random shuffle would keep about 62 in order.

So `compare-likes` lines the two lists up by position. Entries whose video is itself liked on YouTube are anchors, and most songs are. Between two anchors sit a few unexplained Liked songs entries and a few unexplained YouTube likes. When the counts match, they pair up in order: the first leftover like is behind the first leftover entry, and so on. When they don't, nothing is paired, and the entries are reported and left alone. One detail took real data to get right: the anchors have to be the longest increasing subsequence of their positions, because picking them greedily collapsed to a few hundred anchors.

Titles never decide a pair. They come up in one place only: before a repoint, the two videos must look like the same recording, with durations within 3 seconds and either the same channel or one title containing the other. On the 24 pairs whose fixes I could verify, the order-based pairs matched 23, and got one right that a title-based guess had pinned on the wrong song.

## Two writes and a tripwire

Once the backing is known, the fixes come down to two, both on YouTube:

- **repoint**: A is dead and shown as B, and B isn't liked. Like B, confirm it with `getRating`, unlike A, confirm again.
- **unlike shadow**: A is shown as B while B is liked too. Unlike A, and the song appears once.

The disappearing song is also the failure both of them have to catch. If a pair were wrong, unliking A would remove some unrelated song from YT Music, and nothing in YouTube's response would say so. So after every unlike, `sync` reads the whole Liked songs list again. A repoint must leave every song shown the same number of times, and an unlike shadow must remove exactly one copy of B. If the list still doesn't match on a second read 15 seconds later, A is re-liked, the like a repoint just put on B is undone, and the run stops, because a mismatch means the pairs from that scan can't be trusted.

## On my library

I checked the model on 27 likes in my library before building it into the tool. Its first real run cleared the last two duplicates, a making-of video and a fan upload each shown as an official track I had also liked, and each unlike removed exactly one entry. Every one of the 1,172 songs in my Liked songs is now backed by its own YouTube like.

What the tool can't prove, it reports, like likes on unavailable videos that YT Music doesn't show at all; those I cleaned up by hand. Deleted videos had one more quirk: the YouTube Data API returns 404 when you unlike one, but YT Music's rating call removes the like fine.

like-surgeon is on PyPI (`uv tool install likesurgeon`), and `sync --dry-run` shows what it would change without touching anything. The [design doc](https://github.com/zeikar/like-surgeon/blob/main/docs/design/ll-lm-alignment.md) has the evidence in more detail.
