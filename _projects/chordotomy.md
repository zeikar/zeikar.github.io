---
layout: project
title: "chordotomy"
description: "Local harmony analyzer that finds a recording's chords on the beat, inversions included, and labels them with Roman numerals that flag secondary dominants and borrowed chords."
tagline: "Chord Recognition & Roman Numeral Analysis"
tech_stack: ["Python", "librosa", "lv-chordia", "Beat This!", "Vanilla JavaScript", "Claude Code plugin", "PyTorch", "mir_eval"]
github_url: "https://github.com/zeikar/chordotomy"
demo_url: "https://zeikar.dev/chordotomy/"
image: "/assets/images/projects/chordotomy.png"
sequence: 11
gadget_no: 23
date: 2026-09-29
---

chordotomy takes a recording and dissects its harmony. It finds the chords on the beat and reads the bass under each one, so slash chords come out as slash chords. Then it estimates the key and where it changes, and gives every chord a Roman numeral and a role: diatonic, secondary dominant, borrowed or chromatic. A [browser viewer](https://zeikar.dev/chordotomy/) plays the recording with its chords and lets you correct them, and an agent skill writes the chords out and explains the moves it flagged. It analyzes and doesn't transcribe: no staff notation, no melody, on purpose. Most of what people will feed it is commercial recordings, so the audio never leaves your machine. And yes, the name is also a spinal surgery.

## Two engines, one analysis

With its optional extra installed, chordotomy hears chords through lv-chordia, the pretrained ensemble of Jiang, Chen, Li and Xia (ISMIR 2019). Without it, its own DSP front end does the job with no model at all. From the per-beat labels on, both engines run the same code: segment cuts, the bass vote, respelling, and the harmonic analysis. Only the extra brings torch, and the DSP path never imports it, so a plain `pip install chordotomy` stays small. A broken model install stops with an error that names the fix; it never falls back silently to the other engine's chords.

The DSP front end first called too much of a full mix "no chord": a real mix's chroma is never sparse enough for a triad template to beat a flat "no chord" one. It now whitens the constant-Q spectrum against each octave's running background, following Mauch and Dixon's 2010 paper, written from the text because their plugin is GPL. "No chord" stopped being a template too: a beat gets it when no chord clears a bar, or when it is far quieter than the loud ones. [From 0.52 to 0.90](/blog/from-0-52-to-0-90/) follows the accuracy from that first version to the model, with what each step cost.

## The beat grid was costing the model points

lv-chordia labels frames, but the timeline lives on beats, so each beat takes the label that covers most of its frames. On librosa's beat tracker, that snap scored below the model's own frame output; snapped onto the datasets' annotated beats, it scored above. The loss was the tracker's: of GuitarSet's 180 solo-guitar takes, librosa tracked 72 correctly.

The model engine now runs librosa's one-tempo dynamic programming on Beat This!'s beat activation (Foscarin, Schlüter and Widmer, ISMIR 2024), which raised GuitarSet's beat F from 0.517 to 0.919. Beat This!'s own peak picking leaves gaps of up to 1.84 s over chords struck once a bar, which a timeline built from beat cells can't use. The snapped chords now score above lv-chordia's own output on both datasets: majmin (the share of time with the right major or minor triad) 0.950 against 0.947 on Tiny AAM's 20 mixed tracks, and 0.900 against 0.893 on GuitarSet. GuitarSet is in Beat This!'s training data, so those numbers come from fold checkpoints that never trained on the take being scored. On the same audio and scoring it is also ahead of BTC, crema and both ChordMini models. These are development numbers, not a benchmark claim. Beat This!'s 81 MB of weights download once through chordotomy's own loader, not the package's `torch.hub` one, which checks no hash, and are verified against a pinned SHA-256 on every load.

## Reading the bass where octaves stay apart

A chroma folds every octave together, so it can't say which note is lowest. The bass comes from a separate constant-Q transform with a shorter window, so neighbouring beats stay apart. It's the lowest strong peak in the C1 to B3 register, not the loudest, because that's what a bass is. A bass move under an unchanged chord has to hold for two beats before it cuts a segment, so a walking line doesn't turn into a flicker of inversions.

A slash chord is a claim, and at first both engines made it too easily. On a J-pop recording checked against a chart, 4 of the 5 non-chord slashes in the bridge were wrong. lv-chordia's separate bass output had the right note, F♯ under the F♯7 at 0.97, but the code computed it and never read it ([The Model Already Knew](/blog/the-model-already-knew/) has the check). So a bass outside the chord now has to pass a test: on the DSP it must be the register's loudest note, on the model the bass output has to give it at least 0.7. If it fails, the chord reads as root position. Demucs, the obvious way to isolate the bass, was turned down because its pretrained weights carry no license statement.

## Roman numerals from the chords, in Python and in the browser

The key comes from the chords, not the audio, so a corrected chord gets exactly the analysis an extracted one does. Each of the 24 keys scores the beats its diatonic chords take, weighted toward the tonic, subdominant and dominant. Sevenths count: reduced to triads, `C – Am – D7 – G7` would be G major, but the F in G7 keeps it in C. Roles follow a fixed list of rules, and the first match wins. A secondary dominant is known by its fifth relation alone; a secondary leading-tone chord only by where it goes, so that rule looks one chord ahead. So does the one truly ambiguous case: a major I or IV in a minor key is a secondary dominant only when its target comes next, and otherwise borrowed. A song that changes key is split into regions by a Viterbi path over the 24 keys that charges for every change, so a stretch gets its own key only when it reads better there by more than the change costs, and each chord is numbered in its own region's key.

[![The chordotomy viewer: a borrowed Fm (iv) in C major, with its role, bass and alternatives, the key, the editor, and a chord strip colored by role](/assets/images/projects/chordotomy-viewer.webp)](/assets/images/projects/chordotomy-viewer.webp)

The viewer re-runs the analysis after every edit, through a JavaScript port. Python stays the reference: golden vectors written from the Python pin the port, so pytest fails until they're regenerated and Node's test runner fails until the port agrees. The page is plain HTML, CSS and JavaScript with no build step, and its Content-Security-Policy blocks every request but its own scripts and styles. Corrections download as `song.edited.chords.json`; the analyzer's file is never changed. Candidates are ranked, never shown as percentages, because neither engine's scores are calibrated probabilities.

## No LLM in the analyzer

The analyzer never calls an LLM, which keeps it deterministic and testable, and needs no API key. The `extract-chords` skill, installable as a Claude Code plugin or into other agents, runs the analysis locally on a recording or a YouTube link, writes the chords out as a timed chart, and on request explains the key changes, secondary dominants, borrowed chords and bass lines. The agent only ever sees the chord timeline, never the audio.

## Where it stands

Version 0.3.1 is on PyPI. Nothing GPL or AGPL goes in, and the README states what each model was trained on, so anyone who would rather skip models trained on commercial recordings can stay on the DSP. Known gaps are written down: some slash chords still come out in root position, the DSP doesn't call sus2 or 7sus4, and a chart may name a different chord over the same bass. It was built with [hyperclaude](/projects/hyperclaude/), with Codex reviewing the code.
