---
layout: project
title: "pianoize"
description: "Claude Code plugin that turns a song into a two-hand piano arrangement: transcribed on your machine, written by Claude bar by bar, built and checked by code, and played as falling notes."
tech_stack: ["Claude Code plugin", "Python", "tsumugi", "FluidSynth", "Canvas", "FFmpeg", "tsumugi-piano-cover", "Playwright", "Vanilla JavaScript", "mido", "NumPy", "Typer"]
github_url: "https://github.com/zeikar/pianoize"
demo_url: "https://zeikar.dev/pianoize/"
image: "/assets/images/projects/pianoize.png"
sequence: 10
gadget_no: 26
date: 2026-10-08
---

pianoize turns a song into a piano arrangement for two hands and plays it as falling notes, Synthesia style, with the right hand in green and the left in blue. Give it a YouTube link or an audio file and it transcribes the song on your own machine: the band with a track per instrument, the sung melody, and a piano cover generated from them. Claude then writes the arrangement bar by bar as a plain-text score, and pianoize builds the score into MIDI, checks it, and renders it as audio and as a 1920×1080, 60 fps video. It's a Claude Code plugin and a Python CLI, and the recording never leaves your computer. The [viewer](https://zeikar.dev/pianoize/) plays a finished arrangement in the browser, and the videos are made for [pianoize's YouTube channel](https://www.youtube.com/@pianoizemusic).

## Why Claude writes the score

It began with a trial of the audio-to-piano models that run on a Mac, each scored against the original's harmony with [chordotomy](/projects/chordotomy/): render the result, analyze it, and compare it at checkpoints such as a borrowed iv or a chromatic bass line. tsumugi-piano-cover passed 11 of 20 on the first test song, against Etude's 10, and to my ear its render kept the harmony. Etude sounded less clear and its ShareAlike weights would have complicated the videos, Pop2Piano states no license at all, PiCoGen2 needs Linux and a GPU of more than 16 GB, and Sheet Sage needs CUDA. So every arrangement starts from tsumugi's transcription and, for a sung song by default, tsumugi-piano-cover's cover.

The scoring taught a rule the rest of the project keeps: no reading is the answer key. chordotomy read Cm over E♭ as E♭ major, an augmented chord as major, and a melody note on top of the piano as part of the chord, and those misreadings counted as the model's mistakes. So the second milestone had an agent weigh chordotomy's timeline, tsumugi's transcription and the cover's notes against each other and write one refined harmony timeline. Code then listed the places in the cover that might need work, of four kinds: chords that disagree with that harmony, notes that sound like slips, voices that jump, and timing that stumbles. The agent judged each one and wrote a correction spec, which code applied to a copy of the cover.

It worked, but at the listening I compared one excerpt arranged several ways, among them the polished cover, a rule-based arrangement from the melody and the refined chords, the polished cover with a clean melody on top, and a score an agent wrote bar by bar from the cover and the vocal transcription. The score won. It was cleaner than the polished cover, written for two hands, and kept the song's hits. Polishing is still in the repository, but writing the score became the main path.

## A score Claude writes and code builds

The score is a text file, one bar at a time, on the sixteenth grid. Each bar names its chords in pop chord symbols, then up to three hand lines: `M` for the melody, `R` for the rest of the right hand, `L` for the left. A token is a position, the notes and a duration, in sixteenths; `~` marks a passing tone, a note off the chord on purpose. A repeated section is a copy, with whole bars overridden where the repeat differs. This made-up phrase is from the docs:

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

`build-arrangement` lays the score on the cover's tempo map, so bar N of the score sounds where bar N of the cover does. Every note gets one velocity, 88, since most piano covers barely vary their dynamics. The pedal lifts at each chord by default, and lifts again wherever an attack would ring a semitone or a minor ninth against a note it's holding. A pitch struck again in one hand cuts the earlier note short, so the falling notes show two. The CLI never calls an LLM: the same score and cover always give the same MIDI bytes, and there's no API key, because the writing happens in your Claude Code session.

The writing happens in a subagent, `arranger`. A full song's dump, with the band printed under the cover in every bar, runs to thousands of lines, and the loop of building and checking adds more, which would crowd the conversation out of the main session. The arranger gets the shell and the files and nothing else, so the song's content stays on the machine. The main session talks to me, relays the bars I want changed, and continues the same arranger for each revision. Claude can't hear the result, so my listening is the last gate.

## Limits for an advanced pianist's hands

A falling-notes video reads as a piece someone could play, so `check-arrangement` checks each hand against what an advanced pianist can do: at most 7 keys held, a span of at most a twelfth, no crossed hands, and no jump of 19 semitones in under 0.2 s, 26 in under 0.36 s, or more than 36 at any speed. A span of 17 to 19 semitones, wider than a tenth, is listed but not flagged, so it can stay where the music needs it. The melody must stay on top, no key may be struck twice at once, and an accompaniment note outside the score's chord is flagged unless it's marked as a passing tone. The arranger fixes every flagged finding until the check prints `clean`.

The first limits were tighter: 5 keys, a tenth, and jumps of 15, 22 and 26 semitones. On an instrumental with a full band, every note of the transcription on piano sounded better than any reduction to those limits, so they were widened. On a second, every band part on piano beat even the widened limits, though every track of the transcription at once sounded muddy. That led to a full mode, for listening rather than playing, which keeps the fullness and leaves out what muddies it. Its check drops the limits on the hands and keeps the rest. An arrangement from the cover is playable by default, since the cover's accompaniment is already a pianist's; one from the band's transcription alone is full.

Given tsumugi's melody, the check also lists each sung note the top of the right hand leaves out: a top note of its pitch class, in any octave, has to start within 70 ms of it. The list is never flagged, because a note can stay out on purpose, a stray of the transcription or a run too fast to read as it falls. The arranger adds each one or writes down why it stays out.

## A steady tempo under the beat tracker

tsumugi's tempo map comes from a beat tracker, which can run at half speed through long stretches of a song and squeeze bars elsewhere. The cover model builds its beat rows from that map, so the cover's rhythm bends with it, and the bar lines drift off the song's downbeats. So `prepare` fits one steady tempo to the transcription before the cover is made, and keeps every note at its own time in seconds.

The fit is a brute-force search over every tempo within 15% of tsumugi's dominant one, on a 0.01 bpm step (a 0.01 bpm error drifts 18 ms over a 5-minute song), and 32 offsets within a sixteenth. It scores the attacks' mean distance to the nearest sixteenth, each capped so a triplet or an ornament can't pull the grid, and takes about a second on a 5-minute song. A fit is good with at least 300 attacks and 70% of them within a quarter of a sixteenth; attacks placed at random reach 62%. The song is also cut into 10-second spans, and three spans in a row that the grid misses refuse it, so a song that really changes tempo keeps tsumugi's map. The search stays near tsumugi's tempo on purpose: for eighth-note music the attacks can't tell the octave, and on one test song a half-speed grid explained 87% of them against the fit's 89%.

## One page draws the preview and the video

The viewer is plain HTML, CSS and ES modules with no bundler, and it draws any frame from a time `t`. `preview-video` serves it on 127.0.0.1 to watch in a browser; `render-video` loads the same page in the installed Chrome through playwright-core and pipes a PNG per frame into FFmpeg, H.264 tagged BT.709. So the preview and the MP4 can't disagree. The audio is rendered by FluidSynth with the Salamander Grand Piano, and a key lights on the frame of its note-on; the piano's attack passes −40 dBFS about 20 ms later, inside one frame.

The look is lit rather than flat: the notes glow in their hand's colour, and where one meets its key a flare flashes, a beam rises and sparks stream up. These are drawn in-house, since Neothesia's code is GPL. The sparks look random, but each one's randomness is a hash of its note's pitch, onset and its own number, so a seek, the preview and the capture all draw the same frame, and two renders with the same Chrome and FFmpeg give identical MP4 bytes. The notes fall for 3 seconds and the music starts at 3 seconds, so the first notes fall in under the title card and land as the music starts. The thumbnail comes from the same run: the quarter-second with the most notes on screen, zoomed in by 4/3, with the title over a dark band. A `make-video` skill then writes the upload's title, description and tags in English and Korean, with the credits for the song, the SoundFont and, where one was used, the cover model.

On [GitHub Pages](https://zeikar.dev/pianoize/), the page plays an arrangement JSON and its audio, which the arranging skills export. Both files are read in the browser and uploaded nowhere.

## Licenses decide what goes in

The models are installed once into `~/.cache`, never into the repository. Setup pins tsumugi and tsumugi-piano-cover to commits, checks each of tsumugi's ten checkpoint files against a recorded SHA-256, and shows the cover weights' terms before downloading them, about 1.6 GB of weights in all. Recordings, and the MIDI, JSON and video made from them, stay in a gitignored `work/` folder. No GPL or AGPL code goes into the repository or its dependencies, which ruled out Neothesia and YourMT3+.

tsumugi's code and weights are MIT, but tsumugi-piano-cover's weights are CC BY-NC 4.0. An arrangement made from its cover is treated as non-commercial: its video stays non-monetized and credits the model. That's why the second arranging skill, `arrange-transcription`, works clean-room from tsumugi's transcription alone and never reads the cover. It arranges the band for piano layer by layer, and it's the default for instrumentals such as game music, where I preferred it to an arrangement from the cover anyway. Either way a video carries only the piano pianoize renders, never the original audio or vocals separated from it.

## Where it stands

Every step runs, from a link to a finished video, and the first full-song arrangement and video are approved. It's at version 0.1.0, developed on an Apple-silicon Mac, where the transcription takes about twice the song's length. The known gaps are written down, among them that an override replaces a whole bar, with no override for one hand line. It was built over two weeks with [hyperclaude](/projects/hyperclaude/), with Codex reviewing the code.
