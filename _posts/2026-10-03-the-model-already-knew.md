---
title: "The Model Already Knew"
subtitle: "Three bugs in my chord analyzer, two of them found with one J-pop song. Each time, the model had the right answer and my code dropped it."
date: 2026-10-03
unit: chordotomy
lang: en
translations:
  ko: /blog/ko/the-model-already-knew/
redirect_from: /blog/the-model-heard-it-my-code-threw-it-away/
description: "Three bugs in chordotomy, two found by checking one J-pop song against a fan chart. Each time, the model had the right answer and my code dropped it."
---

[chordotomy](/projects/chordotomy/) listens to a recording and writes out its chords, beat by beat. The hearing is done by lv-chordia, a pretrained chord model. My code turns its output into a timeline you can read.

Benchmarks only told me how often it was right on average. So I took one song, 鹿乃 (Kano)'s 光の道標, and checked it chord by chord against a [fan chart on ChordWiki](https://ja.chordwiki.org/wiki/%E5%85%89%E3%81%AE%E9%81%93%E6%A8%99).

The song turned up two bugs, and a question about how the analyzer works turned up a third. None of them was the model's fault.

## 1. Em7/A came out as Asus4

The chart has Em7/A in several places, a suspended dominant that J-pop loves. My analyzer said Asus4.

The model had heard `A:sus4(b7)`, a 7sus4, which is close to what the chart says. But my code translates the model's labels into a smaller vocabulary, and that vocabulary had no 7sus4:

```python
"sus4(b7)": "sus4",  # loses the seventh
```

The comment even admitted it. I added 7sus4 to the vocabulary, and those spots now read A7sus4 (V7sus4).

The benchmarks never noticed. On both datasets the model never outputs a 7sus4, so the scores didn't move by a single digit. Only a real song could show it.

## 2. Slash chords that weren't there

In the bridge, the analyzer wrote F♯7/C and Bm7/D♯. The chart has plain F♯7 and Bm7.

The bass came from a simple rule: take the lowest note that's reasonably loud. In a busy bridge, that rule grabbed a quiet low note under the real one.

The model, meanwhile, has a separate output just for the bass. It said F♯ under the F♯7 with 0.97 confidence. My code computed that output on every run and never read it.

Now a bass outside the chord is kept only when the model backs it. The bridge's fake slashes are gone, and real ones like D/E stay.

## 3. The beats were hurting the chords

The model labels short frames, and I snap those labels to beats so the chords line up with the music. I wondered whether the snapping itself cost accuracy.

It did. But the same snap onto correct beats, taken from the datasets' annotations, scored higher than the raw model. So snapping wasn't the problem. My beat tracker was. On one dataset it got only 72 of 180 recordings right.

I switched to Beat This!, a recent beat-tracking model, and fed its output into a tracker that keeps one steady tempo. Now the analyzer scores above the raw model on both datasets (0.950 vs 0.947, and 0.900 vs 0.893). On the song it held 86 BPM, and where the outro slows down, the beats slow down with it.

## One song finds bugs. It shouldn't decide fixes.

Tuning to a single song is a good way to overfit. So the song only pointed at problems. Each fix also had to hold up on two public datasets and pass a set of synthesized test clips.

Sometimes that meant ignoring the chart. One rule picked the chord from its bass. It fixed two spots in the song and broke two others, turning a correct D/E into Esus4. That rule didn't ship.

The details are in the [repo](https://github.com/zeikar/chordotomy). chordotomy is on PyPI (`uv tool install "chordotomy[model]"`), and the [viewer](https://zeikar.dev/chordotomy/) plays a song with its chords, so you can check one yourself.
