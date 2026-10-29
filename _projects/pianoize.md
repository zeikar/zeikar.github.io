---
layout: project
title: "pianoize"
description: "Claude Code plugin that turns a song into a two-hand piano arrangement: transcribed on your machine, written by Claude bar by bar, built and checked by code, and played as falling notes."
tagline: "AI Piano Arrangement Plugin for Claude Code"
tech_stack: ["Claude Code plugin", "Python", "tsumugi", "FluidSynth", "Canvas", "FFmpeg", "tsumugi-piano-cover", "Playwright", "Vanilla JavaScript", "mido", "NumPy", "Typer"]
github_url: "https://github.com/zeikar/pianoize"
demo_url: "https://zeikar.dev/pianoize/"
image: "/assets/images/projects/pianoize.png"
sequence: 8
gadget_no: 26
date: 2026-10-08
---

pianoize turns a song into a piano arrangement for two hands and plays it as falling notes, Synthesia style, with the right hand in green and the left in blue. Give it a YouTube link or an audio file and it transcribes the song on your own machine: the band with a track per instrument, the sung melody, and a generated piano cover. Claude writes the arrangement bar by bar as a plain-text score; pianoize builds it into MIDI, checks it, and renders audio and a 1920×1080, 60 fps video. It's a Claude Code plugin and a Python CLI, and the recording never leaves your computer. The [viewer](https://zeikar.dev/pianoize/) plays a finished arrangement in the browser, and the videos are made for [pianoize's YouTube channel](https://www.youtube.com/@pianoizemusic).

## Why Claude writes the score

It began with a trial of the audio-to-piano models that run on a Mac, each scored against the original's harmony with [chordotomy](/projects/chordotomy/). tsumugi-piano-cover passed 11 of 20 checkpoints on the first test song, against Etude's 10, and to my ear its render kept the harmony; Etude sounded less clear and carried ShareAlike weights, and the rest were ruled out by their hardware needs or licenses. chordotomy misread some chords itself, and the scoring counted those as the model's mistakes, which set a rule the project keeps: no reading is the answer key.

So the next step had an agent polish the cover against one harmony refined from all the readings. It worked, but at the listening a score an agent wrote bar by bar beat it: cleaner, written for two hands, and keeping the song's hits. Writing the score became the main path. Arranging from the cover now runs on request; by default `arrange-transcription` arranges an instrumental and `arrange-vocal` a sung song, both from tsumugi's transcription alone. Each beat an arrangement from the cover at the listening, and neither carries the cover's non-commercial terms.

## A score Claude writes and code builds

The score is a text file on the sixteenth grid: each bar's chords in pop chord symbols, then up to three hand lines, `M` for the melody, `R` for the rest of the right hand and `L` for the left. A token is a position, the notes and a duration, and `~` marks a passing tone; a repeat copies earlier bars. A made-up phrase from the docs:

```
format 1
== verse | pedal=chord
bar 1 | F
  M 0:A4:4 4:C5:4 8:A4:4 12:G4:4
  R 0:C4+F4:8 8:C4+F4:4
  L 0:F2:12 12:E2~:4
bar 2 | 0:Dm7 8:Bb | pedal=0,x6,8
  M 0:F4:6 8:D5:8
  R 0:A3+C4:6 8:F4:8
  L 0:D2:6 8:Bb1:8
bars 3-4 = 1-2
```

`build-arrangement` lays the score on the song's tempo grid and lifts the pedal at each chord and wherever an attack would ring a semitone or a minor ninth against a held note. The CLI never calls an LLM, so the same inputs always give the same MIDI bytes and there's no API key: the writing happens in your Claude Code session, in an `arranger` subagent. A full song's dump runs to thousands of lines, which would crowd out the main session, and the arranger gets the shell and the files and nothing else, so the song's content stays on the machine. Claude can't hear the result, so my listening is the last gate.

## Limits for an advanced pianist's hands

A falling-notes video reads as a piece someone could play, so `check-arrangement` holds a hand to what an advanced pianist can do: at most 7 keys held, a span of at most a twelfth, no crossed hands, and no jump of 19 semitones in under 0.2 s, 26 in under 0.36 s, or more than 36 at any speed. A span of 17 to 19 semitones is listed but not flagged, so it can stay where the music needs it. The melody stays on top, and an accompaniment note outside the score's chord is flagged unless it's marked as a passing tone. The arranger fixes every flagged finding until the check prints `clean`.

On instrumentals with a full band, every band part on piano sounded better than any reduction to two hands, though every track of the transcription at once was muddy. So a full mode, for listening, keeps the parts, leaves out what muddies them, and drops the limits on the hands. An instrumental is full by default, and a sung song puts a full right hand over a left hand that must pass the limits on its own.

## A steady tempo under the beat tracker

tsumugi's beat tracker can run at half speed through long stretches of a song and squeeze bars elsewhere, so the bar lines drift off the song's downbeats, and everything arranged on that map bends with them. So `prepare` fits one steady tempo to the transcription before the cover is made, and keeps every note at its own time in seconds.

The fit is a brute-force search over every tempo within 15% of tsumugi's dominant one, on a 0.01 bpm step, and takes about a second. It needs 70% of at least 300 attacks on the grid, where random attacks reach 62%, and 30 seconds in a row off the grid refuse it, so a song that really changes tempo keeps tsumugi's map. It stays near tsumugi's tempo because for eighth-note music the attacks can't tell the octave: a half-speed grid explained 87% of one test song's attacks against the fit's 89%.

## One page draws the preview and the video

The viewer is plain HTML, CSS and ES modules, and it draws any frame from a time `t`. `preview-video` serves it to a browser; `render-video` loads the same page in the installed Chrome through playwright-core and pipes a PNG per frame into FFmpeg, so the preview and the MP4 can't disagree. Where a note meets its key a flare flashes and sparks stream up, and each spark's randomness is a hash of its note's pitch, onset and its own number, so a seek, the preview and the capture draw the same frame, and two renders with the same Chrome and FFmpeg give identical MP4 bytes.

## Licenses decide what goes in

Setup installs the models once into `~/.cache`, pinned to commits, checks tsumugi's checkpoints against recorded SHA-256 sums, and shows the cover weights' terms before downloading them. No GPL or AGPL code goes into the repository or its dependencies, which ruled out the transcriber YourMT3+ and the falling-notes renderer Neothesia, so the viewer's effects are drawn in-house.

tsumugi's code and weights are MIT, but tsumugi-piano-cover's weights are CC BY-NC 4.0, so an arrangement made from its cover is treated as non-commercial: its video stays non-monetized and credits the model. The default paths never read the cover. Either way a video carries only the piano pianoize renders, never the original audio or vocals separated from it.

## Where it stands

Every step runs, from a link to a finished video. pianoize is at 0.1.0, developed on an Apple-silicon Mac, where the transcription takes about twice the song's length, and was built over two weeks with [hyperclaude](/projects/hyperclaude/).
