---
layout: project
title: "chordotomy"
description: "Local harmony analyzer that finds a recording's chords on the beat, inversions included, and labels them with Roman numerals that flag secondary dominants and borrowed chords."
tech_stack: ["Python", "librosa", "lv-chordia", "Beat This!", "Vanilla JavaScript", "Claude Code plugin", "PyTorch", "mir_eval"]
github_url: "https://github.com/zeikar/chordotomy"
demo_url: "https://zeikar.dev/chordotomy/"
image: "/assets/images/projects/chordotomy.png"
sequence: 8
gadget_no: 23
date: 2026-09-29
---

chordotomy takes a recording and dissects its harmony. It finds the chords on the beat and reads the bass under each one, so slash chords come out as slash chords. Then it estimates the key and gives every chord a Roman numeral and a role: diatonic, secondary dominant, borrowed or chromatic. A [browser viewer](https://zeikar.dev/chordotomy/) plays the recording with its chords and lets you correct them, and a Claude Code skill explains the moves it flagged. It analyzes and doesn't transcribe: no staff notation, no melody, on purpose. Most of what people will feed it is commercial recordings, so the audio never leaves your machine. It's on PyPI as `chordotomy`. And yes, the name is also a spinal surgery.

## Two engines, one analysis

With its optional extra installed, chordotomy hears chords through lv-chordia, the pretrained ensemble of Jiang, Chen, Li and Xia (ISMIR 2019): five nets, each with heads for the root and triad, the bass, and every extension. Without the extra, its own DSP front end does the job with no model at all. From the per-beat labels on, both engines run the same code: segment cuts, the bass vote, respelling, and the harmonic analysis. Only the extra brings torch, and the DSP path never imports it, so a plain `pip install chordotomy` stays small. A broken model install stops with an error that names the fix. It never falls back silently to the other engine's chords.

The DSP front end started out hearing silence in full mixes. The first version summed the spectrum into a chroma and scored it by cosine against binary templates plus a flat one for "no chord". On Tiny AAM, 20 annotated mixed tracks, it called 12% of the duration "no chord" where the annotation has 1.5%, and 77% of one track. A real mix's chroma is never sparse enough for a triad to beat a flat line. Now each frame of the constant-Q spectrum is whitened against its octave's running background, as in Mauch and Dixon's 2010 paper. That was implemented from the paper, because their plugin is GPL. The whitened chroma is scored by correlation against templates that carry each tone's first four partials. A Viterbi decode then smooths the labels. Its odds of holding a chord are set in seconds rather than beats, so a tracker locked at half or double tempo doesn't double or halve the expected chord length. "No chord" is now a gate on tonal evidence, chiefly the beat's spectral flatness and the harmonic share of its energy, rather than a template.

## The beat grid was costing the model points

lv-chordia labels frames, but the timeline, the bass and the viewer's edits all live on beats. So each beat takes the label that covers most of its frames. On librosa's beat tracker, that snap scored below the model's own frame output: 1.3 points of majmin (the share of time with the right major or minor triad) on Tiny AAM and 2.1 on GuitarSet, 180 solo-guitar takes. Snapped onto the datasets' annotated beats instead, it scored 1.4 and 1.3 points above. The loss was the tracker's. Of GuitarSet's 180 takes, librosa tracked 72 correctly. The rest it locked at half or double tempo, at 3:2 or 4:3, or on the off-beat, or let drift.

The model engine now tracks beats with Beat This! (Foscarin, Schlüter and Widmer, ISMIR 2024), but it keeps librosa's one-tempo dynamic programming on top of Beat This!'s beat activation. Beat This!'s own peak picking has the best beat F on Tiny AAM, but its beats aren't periodic. Over chords struck once a bar it leaves gaps of up to 1.84 s, which a timeline built from beat cells can't use. madmom's DBN, the usual post-processing, switched to the triplet pulse on a syncopated test clip, and its model files are licensed for non-commercial use only. With the activation under librosa's DP, GuitarSet's beat F rose from 0.517 to 0.919. The snapped chords now score above lv-chordia's own output on both datasets: majmin 0.950 against 0.947 on Tiny AAM, and 0.900 against 0.893 on GuitarSet. GuitarSet is in Beat This!'s training data, so those GuitarSet numbers come from fold checkpoints that never trained on the take being scored. On the same audio and scoring, the model engine is also ahead of BTC, crema and both ChordMini models, each run through its own inference code. These are development numbers, not a benchmark claim.

Beat This!'s spectrogram is rebuilt with `torch.stft` and librosa's mel filterbank. It agrees with the package's torchaudio front end to within 1e-4, so torchaudio is never imported. The 81 MB of weights download once and are checked against a pinned SHA-256 on every load. The package's own loader goes through `torch.hub`, which checks no hash, from a server whose URL has already broken once.

## Reading the bass where octaves stay apart

A chroma folds every octave together, so it can't say which note is lowest. The bass comes from a separate constant-Q transform at 12 bins per octave. Its window at C1 is 0.53 s, against 1.59 s for the chord transform, so neighbouring beats stay apart. The bass is the lowest peak in the C1 to B3 register that reaches half of the register's loudest. It's the lowest rather than the loudest, because that's what a bass is. A bass move under an unchanged chord has to hold for two beats before it cuts a segment. So a walking line or an alternating C–E accompaniment doesn't turn into a flicker of inversions.

A slash chord is a claim, and at first both engines made it too easily. On a J-pop recording checked against a chart, every slash in the verses and choruses was right, but 4 of the 5 non-chord slashes in the bridge were wrong ([the write-up](/blog/the-model-heard-it-my-code-threw-it-away/) has the whole check). So a bass outside the chord now has to pass a test. On the DSP it must be the register's loudest note; on the model, lv-chordia's bass head has to give it at least 0.7. If it fails, the chord reads as root position. Demucs, the obvious way to isolate the bass, was turned down. Its code is MIT, but its pretrained weights carry no license statement and were trained partly on a non-commercial dataset.

## Roman numerals from the chords, in Python and in the browser

The key comes from the chords, not the audio, so a corrected chord gets exactly the analysis an extracted one does. Each of the 24 keys scores the beats its diatonic chords take, weighted toward the tonic, subdominant and dominant. Sevenths count: reduced to triads, `C – Am – D7 – G7` would be G major, but the F in G7 keeps it in C. Roles follow a fixed list of rules, and the first match wins. A secondary dominant is known by its fifth relation alone. A secondary leading-tone chord is known only by where it goes, so that rule looks one chord ahead. So does the one truly ambiguous case, a major I or IV in a minor key. Either one counts as a secondary dominant only when its target comes next, and otherwise as borrowed. Diminished sevenths and augmented triads share their notes with other roots, so they're respelled by where they lead, as a musician would spell them. An Edim7 that goes to Dm is written C♯dim7, with the same four notes.

[![The chordotomy viewer: a borrowed Fm (iv) in C major, with its role, bass and alternatives, the key, the editor, and a chord strip colored by role](/assets/images/projects/chordotomy-viewer.webp)](/assets/images/projects/chordotomy-viewer.webp)

The viewer re-runs the analysis after every edit, through a JavaScript port. Python stays the reference. Golden vectors written from the Python pin the port, so pytest fails until they're regenerated and Node's test runner fails until the port agrees. The page is plain HTML, CSS and JavaScript with no build step, and its Content-Security-Policy blocks every request except the page's own scripts and styles. It works opened from `file://`. It can play the detected chords as synthesized tones under the recording, so you can check them by ear. It saves corrections as `song.edited.chords.json` and never touches the analyzer's file. The candidates it offers are ranked, never shown as percentages, because neither engine's scores are calibrated probabilities.

## Explanations without an API key

The analyzer never calls an LLM, which keeps it deterministic and testable. It needs no API key or LLM SDK, and its only network use is the one-time download of the beat tracker's weights. The explanations come from elsewhere: the repository is also a Claude Code plugin. Its `explain-harmony` skill runs the analysis locally, reads the JSON (the edited file first, if you saved one) and explains the secondary dominants, borrowed chords and bass lines. Claude only ever sees the chord timeline, never the audio.

## Where it stands

Version 0.2.0 is on PyPI. `uv tool install "chordotomy[model]"` comes to about 600 MB with torch on macOS. Leaving out the extra gives the DSP alone. On an Apple M4 the model engine takes about 4.5 s per minute of audio, and the DSP about 2.2. Dependencies are checked for their terms, the weights' included, and nothing GPL or AGPL goes in. The README states what each model was trained on, so anyone who would rather skip models trained on commercial recordings can stay on the DSP. Known gaps are written down: some slash chords still come out in root position, the DSP doesn't call sus2 or 7sus4, and a chart may name a different chord over the same bass. It was built over five days with [hyperclaude](/projects/hyperclaude/), with Codex reviewing the code.
