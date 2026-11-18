---
title: "Three Bugs Where chordotomy Threw Away What Its Model Got Right"
subtitle: "The model already knew, and it took one J-pop song, checked chord by chord against a fan chart, for me to see it."
date: 2026-10-03
unit: chordotomy
last_modified_at: 2026-11-18
lang: en
translations:
  ko: /blog/ko/the-model-already-knew/
redirect_from: /blog/the-model-heard-it-my-code-threw-it-away/
description: "Three bugs in chordotomy: a label table that flattened 7sus4 to sus4, a bass output computed and never read, and beat tracking that cost the model accuracy. Each time, the model already knew."
---

[chordotomy](/projects/chordotomy/) listens to a recording and writes out its chords, beat by beat. The hearing is done by lv-chordia, a pretrained chord model. My code turns its output into a timeline you can read. How its accuracy went from 0.52 to 0.90 is [a separate post](/blog/from-0-52-to-0-90/).

Benchmarks only told me how often it was right on average. So I took one song, 鹿乃 (Kano)'s 光の道標, and checked it chord by chord against a [fan chart on ChordWiki](https://ja.chordwiki.org/wiki/%E5%85%89%E3%81%AE%E9%81%93%E6%A8%99).

The song turned up two bugs, and a question about how the analyzer works turned up a third. None of them was the model's fault.

## 1. Em7/A came out as Asus4

The chart has Em7/A in several places: IIm7 over V in D major, a suspended dominant that J-pop loves. As notes it's an A9sus4, which without the ninth is an A7sus4. My analyzer called those 17 beats Asus4.

The model had heard `A:sus4(b7)`, a 7sus4. But my code translates the model's labels into a smaller vocabulary, and that vocabulary had no 7sus4:

```python
"sus4(b7)": "sus4",  # loses the seventh
```

The comment even admitted it. I added 7sus4 to the vocabulary, and those spots now read A7sus4 (V7sus4).

The benchmarks never noticed. A 7sus4 is 0.07% of GuitarSet's annotations and absent from Tiny AAM's, and the model never output one on either dataset, so the scores didn't move by a single digit. Only a real song could show it.

## 2. Slash chords that weren't there

In the bridge, the analyzer wrote F♯7/C and Bm7/D♯. The chart has plain F♯7 and Bm7. Of the five bridge spots where it wrote a bass outside the chord, four were wrong like this.

The bass came from a simple rule: the lowest note at least half as loud as the loudest in that register. In a bridge that changes chords every two beats, that rule grabbed a quiet low note under the real bass.

The model, meanwhile, has a separate output just for the bass. My code computed it on every run and never read it. When I looked, it matched the chart everywhere the chart could check it, and it gave the wrong notes my rule picked 0.00 to 0.02.

Now a bass outside the chord is kept only when the model's bass output backs it. The bridge's fake slashes are gone, and real ones like D/E stay. How much this moved the dataset scores, and why, is in [that post's bass step](/blog/from-0-52-to-0-90/).

## 3. The beats were hurting the chords

The model labels short frames, and I snap those labels to beats. The snapped result scored lower than the model's raw frames on both datasets. Once again the model had it right and my side was costing it.

Snapping onto the datasets' annotated beats scored higher than the raw frames, so the snapping wasn't the problem; my beat tracker was. Switching to Beat This!, and what that cost, is in [that post's beat step](/blog/from-0-52-to-0-90/).

On this song the new beats held 86 BPM, and where the outro slows down, the beats slow down with it.

## Not tuning to one song

Tuning to a single song is a good way to overfit. So the song only pointed at problems. Each fix also had to hold up on two public datasets and pass a set of synthesized test clips.

Sometimes that meant ignoring the chart. I tried a rule that re-picked the chord from its bass. It fixed two spots in the song and broke two others, turning a correct D/E into Esus4. The rule trusts the bass and changes the chord, and as the bridge showed, the bass is often the part that's wrong. It didn't ship.
