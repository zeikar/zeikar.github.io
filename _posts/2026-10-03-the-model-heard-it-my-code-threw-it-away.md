---
title: "The Model Heard It. My Code Threw It Away."
subtitle: "I checked my chord analyzer against a fan chart of one J-pop song. The chart caught two bugs and a question caught a third, and all three had the same cause: the model had the answer, and my pipeline lost it on the way out."
date: 2026-10-03
lang: en
translations:
  ko: /blog/ko/the-model-heard-it-my-code-threw-it-away/
description: "Checking chordotomy against a ChordWiki chart of Kano's 光の道標 turned up a 7sus4 folded into sus4, a bass head nobody read, and a beat tracker that cost more than the model's own output. The fixes, and how they were judged."
---

[chordotomy](/projects/chordotomy/) takes a recording and finds its chords on the beat, with the bass under each one and a Roman numeral that says what the chord is doing. Its best ears are borrowed. lv-chordia, a pretrained chord recognizer (Jiang, Chen, Li and Xia, ISMIR 2019), labels the audio frame by frame, and my code turns those labels into a timeline of beats, chord segments and numerals.

Two public datasets tell me how often it's right on average: Tiny AAM, 20 annotated mixed tracks, and GuitarSet, 180 solo-guitar takes. To see where it goes wrong, I needed one song I could check chord by chord. I picked 鹿乃 (Kano)'s 光の道標 (Hikari no Michishirube), the instrumental version: D major, 86 BPM, with a bridge that changes chord every two beats. I can't reliably transcribe chords by ear, so I compared the analyzer's output with a fan chart on [ChordWiki](https://ja.chordwiki.org/wiki/%E5%85%89%E3%81%AE%E9%81%93%E6%A8%99).

The chart caught two bugs, and a question about how the analyzer works caught a third. All three had the same cause: lv-chordia had heard it right, and my code threw it away.

## Em7/A came out as Asus4

Where the music leans back to D, the chart writes Em7/A several times: an E minor seventh over an A bass. It's the suspended dominant J-pop loves, IIm7 over V. The A is in the bass and there's no C♯ anywhere, so the dominant never sounds its third. My analyzer said Asus4.

At those spots lv-chordia's raw output said `A:sus4(b7)`, a 7sus4: A, D, E and G, which is the chart's chord without its B. My code maps lv-chordia's labels onto chordotomy's smaller vocabulary, and that vocabulary had no 7sus4, so the mapping folded it into the nearest chord it had:

```python
"sus4(b7)": "sus4",  # loses the seventh
```

The comment even said so. About 12 seconds of the song's 7sus4 came out as plain sus4, exactly where the chart has Em7/A.

The fix added 7sus4 to the vocabulary, with the numeral V7sus4. It's written `A:sus4(b7)`, the standard Harte syntax that mir_eval, the scoring library, can read. Six spots now read A7sus4, V7sus4: 0:59.5, 1:38.4, 1:49.6, 2:34.8, 3:14.4 and 4:36.2.

The datasets never noticed either way. lv-chordia emitted no `sus4(b7)` on Tiny AAM or GuitarSet, so the model engine scored the same before and after, to the printed digit. Only the song could find this one.

chordotomy's own DSP engine, the one that runs without the model, still doesn't call 7sus4. It scores each chord template against the audio, and a 7sus4 template needs a bias on its score. To get a synthesized V7sus4 → V7 → I cadence right, the bias had to be −0.23 or higher. To keep Tiny AAM's scores, it had to be −0.2375 or lower. The two ranges don't overlap, so the DSP leaves this chord to the model.

## The bass head nobody read

Slash chords were next. In the verses and choruses every slash chord matched the chart: A/C♯, D/E, D/F♯, D/A and F♯/A♯. The bridge was a mess. Where the chart has F♯7, Bm7, GmM7 and B7sus4, with no slash at all, the analyzer wrote F♯7/C, Bm7/D♯, Gm/A and Bm7/G, the last one twice. When I showed the output to ChatGPT, it flagged F♯7/C and Bm7/D♯ too.

Both engines took the bass from the same DSP pick: the lowest note in the C1–B3 register that reaches half the loudest note there. Lowest, because that's what a bass is. In the bridge that rule picked weaker low notes, at about half to three quarters of the loudest, under a louder bass that was the chord's root.

Meanwhile lv-chordia has a bass head. For every frame it gives a probability to each of the 12 bass notes and to "no bass". My engine computed it on every run and never read it. Averaged over each beat, it agreed with the chart at every spot I checked but one: E under the D/E on all four beats (0.84 to 0.95), F♯ under the F♯7 (0.97), B under the Bm7 (0.92), G under the GmM7 (0.95). The one miss it shares with the DSP: the chart's C♯7/E♯ is a plain C♯7 to both.

So a bass outside the chord now has to earn its slash. On the model engine, a chord tone is kept as it is, and a note outside the chord needs at least 0.7 from the bass head, or the chord reads with its root in the bass. On the DSP, which has no bass head, a note outside the chord has to be the loudest in the register.

The bridge now reads F♯7, Bm7, Gm and Bm7. The basses are right. The chord names are still lv-chordia's call: GmM7 isn't in the vocabulary, and lv-chordia hears that B7sus4 as Bm7. D/E kept its E. The time the analyzer writes a bass outside the chord fell from 26.9 s to 12.0 s.

Over this bass work, the model engine's GuitarSet majmin, the share of time with the right major or minor triad, went from 0.787 to 0.872, and its sevenths, the same for seventh chords, from 0.676 to 0.819. Most of that is how scoring works, not better hearing. A bass outside the chord adds a note to the chord being scored, so the false slashes had been costing chord accuracy all along.

## The beats were costing the model points

The third bug started as a question, not a chart line. lv-chordia labels frames, and chordotomy snaps them to beats, so the timeline, the bass and the viewer's edits all line up on the same cells. Would the raw frames be more accurate?

They were. Snapped to librosa's beats, chordotomy's majmin was 1.3 points below lv-chordia's own frame output on Tiny AAM, and 2.1 below on GuitarSet. But the same frames snapped to the datasets' annotated beats scored 1.4 and 1.3 points above it. Snapping wasn't the problem. The beat tracker was: of GuitarSet's 180 takes, librosa tracked 72 correctly.

The model engine now finds its beats with Beat This! (Foscarin, Schlüter and Widmer, ISMIR 2024), but not with Beat This!'s own beats. Its peak picking scores the best beat F on Tiny AAM, 0.946, where beat F is roughly the share of beats within 70 ms of the annotated ones. But those beats aren't evenly spaced: over chords struck once a bar it leaves gaps of up to 1.84 s. madmom's DBN, the usual smoothing step, switched to the triplet pulse on a syncopated test clip. So chordotomy feeds Beat This!'s beat probability into librosa's tracker, which fits one steady tempo to the whole song. Of the ways I tried to read Beat This!'s output, that was the only one that kept the syncopated clip on one grid.

A steady grid gives up some beat F: 0.896 on Tiny AAM, up from librosa's 0.827. On GuitarSet it went from 0.517 to 0.919. The snapped chords now beat lv-chordia's raw output on both datasets: majmin 0.950 against 0.947 on Tiny AAM, and 0.900 against 0.893 on GuitarSet. Beat This! was trained on GuitarSet, so those GuitarSet numbers come from its fold checkpoints, each take scored by a checkpoint that never trained on that take, though it had heard other takes of the same tune.

The song kept its 86 BPM, with 435 beats against librosa's 437, and 97.6% of it kept the same chords. Its longest beats, up to 0.86 s against a median of 0.70, are mostly in the outro. The song slows down there, and the grid now follows it.

## The song finds the bugs. It doesn't get the last word.

One song is a great place to find bugs and a terrible place to tune. The chart did set some of the rules: the bass rule had to move the bridge's slashes to root position, D/E had to keep its E, and the thresholds were bounded by where those spots flipped. But every fix also had to pass two tests the song couldn't set. It had to hold its floors on Tiny AAM and GuitarSet, no loss on the chord scores or a small price stated in advance. And a suite of synthesized clips had to stay green: a D/E held for four beats has to stay a slash chord, a passing bass under a two-beat chord must not become one, and a V7sus4 the model hears has to reach the timeline as V7sus4 → V7 → I.

Sometimes that meant not doing what the chart said. At one D/A in the bridge, the analyzer writes Bm/A: the bass is right, and D was lv-chordia's second choice. I tried re-picking the chord from its bass. Against the chart it fixed two spots and broke two others, including the correct D/E, which turned into Esus4. That rule never shipped, and that D/A stays a known gap, along with the C♯7/E♯.

The datasets don't get a free pass either. When the beats moved, inversion recall on GuitarSet, the share of the reference's inversions the analyzer also writes, fell from 0.208 to 0.191, under the floor the bass work had held. It wasn't the bass threshold, and it wasn't the takes Beat This! tracks at half tempo. The beats themselves had moved: Beat This!'s land a median 6 ms after the annotated beats, where librosa's landed about 35 ms late, and which bass note holds for two beats depends on where the beats fall. One fingerpicked take, whose lowest note cycles through the chord within each beat, costs about a point on its own. Shifting any beat grid by one or two frames, 23 ms each, moves the number by about a point, and librosa's own grid falls under that floor the same way. That stage had floored the chord scores, and the score that counts the chord and its bass together rose from 0.592 to 0.611, so I kept the drop and wrote down why.

The recording and the chart never went into the repository. The docs describe the checks without naming the song. What's in the repo are the fixes, the synthesized tests that hold them, and the dataset scores. chordotomy 0.2.0 is on PyPI (`uv tool install "chordotomy[model]"`), and the [viewer](https://zeikar.dev/chordotomy/) plays a recording with its chords if you'd like to check one of your own.
