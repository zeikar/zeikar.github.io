---
layout: project
title: "like-surgeon"
description: "Local-first CLI that snapshots YouTube Music and YouTube likes into SQLite, explains where they diverged, and repairs them after confirmation."
tech_stack: ["Python", "ytmusicapi", "YouTube Data API v3", "SQLite", "RapidFuzz", "Typer", "SQLAlchemy"]
github_url: "https://github.com/zeikar/like-surgeon"
sequence: 4
gadget_no: 15
---

YouTube Music and YouTube each keep a list of your likes, and the two drift apart without telling you. Songs go dead, get swapped for re-uploads, or exist on one side only. like-surgeon scans both lists, keeps every scan as a frozen snapshot, and turns the differences into findings it can explain and, where it's safe, fix.

## One relink, several findings

Most findings trace back to one YouTube Music behavior. When a liked song's license expires, YT Music creates a replacement track with a new video ID and moves your like to it. YouTube doesn't follow, so its like still points at the dead original. If the replacement's title and artists still match closely, that shows up as pointer drift; if not, as a song liked only in YT Music. Liking the replacement on YouTube then produces a duplicate, because YT Music propagates the like back next to the entry it already had. Fixing one bucket often just moves the song into another, so repairs have to account for the whole lifecycle.

## Matching and ghosts

`compare-likes` matches the snapshots in stages: exact video ID, a normalized `artists|title` key, then RapidFuzz on title and artists. With YouTube auth, a fourth pass pairs leftover videos that share a channel, a normalized title and a duration within two seconds, which catches label re-uploads the text matching misses.

Dead likes are caught at scan time. Asking `videos.list` for `contentDetails` alongside the status adds each video's region restriction at no extra quota, since the call costs one unit however many parts it requests. Deleted, private and rejected videos become findings. Region-blocked ones don't: a restriction can lift, and unliking would lose the like for good.

## Repairs, and the one it doesn't make

`sync` prints its plan and quota cost first, and orders its calls to fail safe. Moving a drifted like adds the new like before removing the old one, so a half-finished fix leaves a duplicate, not a lost like. A song liked on YouTube but missing from YT Music is unliked and re-liked to trigger propagation, then checked in YT Music five seconds later.

Pairing a relinked replacement with its dead original by title alone was planned, reviewed twice and parked. Titles are a false-positive trap, where a translated subtitle and a remix tag look alike, and a wrong pair would feed the like-then-unlike fix. For that case the tool reports and I move the like by hand.
