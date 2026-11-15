---
title: "Liked, but Not on the Artist Page"
subtitle: "The same recording sits on a single, an album and a best-of as separate videos, and a like belongs to just one of them. I added canonicalize to like-surgeon to move each like to the version the artist page lists, and it turned up 7 duplicate likes I didn't know I had."
date: 2026-11-15
unit: like-surgeon
lang: en
translations:
  ko: /blog/ko/liked-but-not-on-the-artist-page/
description: "Why a song you liked shows up without a like in a YouTube Music artist's Top songs, and how like-surgeon 0.13.0's canonicalize finds the same recording in the artist's song list, moves the like there, and clears same-song duplicate likes."
---

I opened Poppin'Party's artist page on YouTube Music, and the #1 track in Top songs, キズナミュージック♪ (Kizuna Music♪), had no like on it. I had liked that song. It was right there in my Liked songs.

They turned out to be different videos. The one I had liked is the audio track from the single "Kizuna Music♪"; the one in Top songs is the audio track from the album "Breakthrough!". Both are the same 316-second recording, but a YouTube like belongs to one video, so the album's copy has none.

## How many songs are like this

I read the 314 artist pages behind my 1,213 liked songs and compared each artist's "Show all" song list with my likes: 71 liked songs weren't in the list, but the same recording was, on another release. Most of them I had liked from best-of albums like μ's Best Album or Aqours CHRONICLE, while the artist page lists the original single. Some go the other way, like Kizuna Music♪. [like-surgeon](/projects/like-surgeon/), my CLI for YouTube Music likes, takes whichever version the artist page shows.

## This time it matches titles

In [the last post](/blog/the-like-never-moved/), like-surgeon never matched songs by title: YouTube Liked videos and YT Music Liked songs are in the same order, and lining them up shows which like is behind each song. Here every song is already shown as itself, and the album copy isn't in either list, so lining them up can't point to it. A title can't unlike the wrong song either: the original is checked as my own like before anything is written, and the title only picks where the like goes. Titles it is, in a narrow scope:

- only inside the song's own artist list,
- both versions are audio tracks (ATV),
- the normalized titles are exactly equal and the lengths are within 1 second,
- and exactly one such track exists.

Length alone isn't enough: the same list has "キズナミュージック♪ (instrumental)" at 317 seconds.

A version word in the liked track's album name (Version, Live, Remix and so on) could mean a different recording, so those findings are report-only. Most of the ones that got flagged were "Best Live! collection", which is the name of a best-of album, not a live recording. So after reviewing the report you can include them with `--include-flagged`.

```bash
likesurgeon canonicalize                            # report only
likesurgeon skip <id>                               # drop any you disagree with
likesurgeon canonicalize --apply --include-flagged  # move them
```

## How a like moves

On YouTube it likes the artist page's version (B) and confirms it, then removes the original like (A) and confirms that. Last, it reads all of Liked songs again and checks that the only change is one A gone and one B added. Anything else, and it likes A again, takes back B's like, and stops.

If B is already liked, it only removes A. That was the case for 7 of the 71: I had liked the same song twice as two releases, so it was in Liked songs twice, and since both likes were perfectly valid, compare-likes, which finds songs shown as the wrong video, never flagged them.

Each song takes about 18 seconds, mostly waiting for YouTube to catch up and reading the whole list again. I kept the full re-read anyway; it's the only way to notice that unliking A took a different song off Liked songs.

## Artist pages were shakier than expected

ytmusicapi's `get_artist` failed on 68 of my artists. Most were plain YouTube channels rather than artists, and a few had an untitled "new music video" shelf at the top that broke the parser. So like-surgeon reads the response itself.

After I had moved everything, I looked again and the Top songs shelf was missing from the response altogether, signed in or not, however many times I asked. ytmusicapi's source has a comment for it: "API sometimes does not return songs". Treating that like a plain channel, as "no song list", would make those songs drop out of the report without a word, or, for a song credited to several artists, let another artist's list pick a B while the missing list might have had A. Now the page is read once more, and if the list is still missing it counts as unreadable: that artist's songs get no finding, and the report says to re-run later.

YT Music cookies taken from the browser expired within 40 minutes to an hour, and one batch of 20 broke off halfway. Now a failed Liked songs read pulls fresh cookies from the browser once, and keeps them only if the browser is still signed in to the account I authenticated with.

## Result

All 71 moved, and the likes now show in the artists' song lists. Each of the 7 duplicates is down to one like. It's in like-surgeon [0.13.0](https://pypi.org/project/likesurgeon/).
