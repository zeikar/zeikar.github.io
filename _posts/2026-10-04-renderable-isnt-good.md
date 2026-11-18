---
title: "Refining Agent-Rigged 2D Characters with a Reference and a Critic"
subtitle: "Renderable isn't the same as good, so the agent got a picture to aim at and a separate critic to judge it, but the head turn still scores lowest."
date: 2026-10-04
unit: iki
last_modified_at: 2026-11-18
lang: en
translations:
  ko: /blog/ko/renderable-isnt-good/
description: "How Iki's Claude Code plugin builds rigged 2D characters: an artist agent and a separate critic agent, looped against generated reference images."
---

[Iki](/projects/iki/) is a 2D rig engine for the web, and its Claude Code plugin lets an agent build a rigged character from a sentence. An image model draws each part, a composer lays the parts out on one canvas, and an auto-rigger turns the layers into a character that blinks, talks and turns its head. The trouble was that the characters it produced moved fine and didn't look good.

![The same orange-haired character in a sailor uniform, four times in a two-by-two grid. Top row: the front reference illustration and the rigged character at rest. Bottom row: a reference drawn with the head turned 30 degrees and the rigged character turned to its limit.](/assets/images/blog/iki-reference-vs-render.webp){: width="600" style="margin-inline: auto"}

*Top: the front reference and the rig at rest. Bottom: the turned reference and the rig turned to its limit. The rest pose is close. The turn is not.*

## "Done" meant "it renders"

The first character skill ([`6a81d43`](https://github.com/zeikar/iki/commit/6a81d43), June), the instructions the agent loads for the job, ended with a check in Iki's browser playground: drive the blink, gaze, mouth and head-turn parameters, take screenshots, and

> A clean console (no `IkiFormatError`/WebGL error) plus visibly-driving parameters = success.

The agent followed that faithfully. In September, asked for a demo character, it reported back: "Demo model's ready. Blink, gaze, lip sync, head turn, brows and hair sway all work." All true. It still didn't look like a character anyone would draw, or like the natural, pretty 2D anime character I was after.

The agent had looked at its screenshots. It looked for breakage, because that was what success meant, and nothing in its context said what *good* looked like.

There was a second problem underneath. Each part is generated separately, and nothing tied the parts together but a shared style string. They drifted: one run came back with a photoreal macro-photo iris on a flat cel-shaded face, another with orange highlights in the front hair and none in the back.

## A target, and someone else to judge it

So I proposed something like a GAN, half as a joke. Draw a reference character first, have the agent build toward it, and have a separate reviewer compare the two and send it back. It became a skill and two agents the same afternoon ([`df7793a`](https://github.com/zeikar/iki/commit/df7793a)):

- The reference is generated once, picked by me from two or three candidates, then frozen. It's attached to every part-generation job, so every part is drawn against the same picture. Changing it mid-loop would invalidate every score so far.
- The artist agent draws parts, composes them, tunes the layout and rigs. It owns every edit to the character and may not touch the engine packages, which ship to npm.
- The critic agent scores the render against the reference from 0 to 5 on seven axes (face, eyes, hair, body, palette, line, rig), writes findings, and ends with a verdict: `ship`, or another round. It never edits anything.
- The orchestrator is the main session. It dispatches both agents, renders the character in the browser, carries files between them and enforces the round limits. Rendering stays with it because there's one Playwright browser, and two agents driving it collide.

One round is an artist pass, a render, and a critic pass. Why the maker shouldn't grade its own work, I've written about before, in [Three Agents, One Document](/blog/three-agents-one-document/). Two things were different with pictures.

First, it isn't really a GAN. A discriminator hands the generator a gradient. Here the signal is a paragraph of prose, fed to an image model with weak prompt adherence, so rounds can wander instead of descend. So the loop needs hard limits. At most three rounds may spend on image generation, and the loop stops when two rounds in a row raise no axis to a new best. That's a high-water mark per axis, because a plain total can net a real gain in `rig` against a drift in `palette` and read as no progress.

Second, most of what looked wrong wasn't the art.

## Four of six defects weren't art

The session that produced the demo character left six defects:

| Defect | Actual cause | Redraw fixes it? |
|---|---|---|
| Iris reads as a bead in white | the composer's iris ratio | no |
| Head slides off the shoulders | the auto-rig's turn binding | no |
| Brows invisible | draw order vs. hairstyle | no |
| Lash misaligned from the eye | a careless layout edit | no |
| Straight seam on a head turn | art cut off by its own frame | yes |
| Photoreal iris on a flat face | style drift | yes |

A critic that can only say "try again" would have spent the image quota on four problems a redraw can't fix. So every finding carries a type, and the type decides who acts:

- `regenerate`: the art itself is wrong. Billed: each part is one image-model call through `codex exec`, minutes each, and with 11 parts drawn twice each, a full set is 22 of them.
- `retune`: the art is fine, but its placement, its scale or the rig's tuning is off. Free, because composing and rigging run locally.
- `escalate`: the fix is in the engine. The artist can't act on it, and the orchestrator decides.

The critic has to ask whether a `retune` would do before it writes a `regenerate`.

## The critic was too kind

The first loop ran two rounds: 24/35, then 29/35 and `ship`. I looked at the result and listed five things wrong with it.

It wasn't for lack of safeguards. The critic's first step was a geometry check, and its instructions said "the iris looks big" is worthless while "the iris is 33% of the sclera width, target 0.45–0.60" is a fix. `ship` already needed every axis at 4 or more and no pending redraws. The first critic ran on Sonnet, went through both, and still gave 29.

I had a fresh critic, running on Fable, re-score the same character, briefed with my five complaints and told to treat the 29 as suspect. It gave **14/35** and confirmed all five with numbers. The mouth spanned 43% of the face's width at its row, where the reference's spans 27%. Brow to chin measured 0.57 of the face's width, against 0.89. The neck slid 190 px when the head turned. The first critic had given that rig a 4. The geometry check only measured defects that had already bitten once, like the iris, the lash's position and parts cut off by their frame. Nothing measured mouth width, face length or how far the neck slid.

The orchestrator's diagnosis was in two parts. The rubric defined 5 as "indistinguishable" and nothing else, so 3 and 4 were impressions, and a critic grading its own pipeline's output drifted toward optimism. And `rig` only asked whether something broke, never whether something moved that shouldn't.

The new critic found one more problem. `rest.png`, the frame every proportion is measured against, was a hero shot with the head turned 9°, which the orchestrator had saved under that name. Two rounds had judged resemblance against a turned head. The same day, the rest shot became one taken untouched, before any slider moves ([`55f9f6c`](https://github.com/zeikar/iki/commit/55f9f6c)). The critic's model changed three weeks later, and both agents run on Opus now ([`ccc0b6f`](https://github.com/zeikar/iki/commit/ccc0b6f)).

Numbers have limits too. The 0.60 iris ceiling in that very example was a guess. Measured on the reference, the iris ran about 0.70 of the sclera width, and until the ceiling was raised, that correct value was flagged as a defect three rounds running. And whenever a number and a side-by-side image disagreed, on iris size, lash structure or palette, the side-by-side won.

## Then the head turned

A few rounds later the front view was close. Then I turned the head, and the next morning it still looked off. Turns in Live2D, the commercial tool many VTuber models are rigged in, look much more natural.

The rubric couldn't see it. A turn that reads as a flat cutout sliding sideways doesn't break anything, so it could score full marks on `rig`. And a front-facing reference has nothing to say about a turn. Two changes went in ([`92a2063`](https://github.com/zeikar/iki/commit/92a2063)):

- A `turn` axis. Does the head read as turning in depth, with the eyes, nose and mouth shifting further than the face's outline, the nose most? Or as a cutout sliding sideways?
- Screenshots partway through the turn. The engine blends linearly between the angles the rig stores keys at, and blending defects show between those keys, where a screenshot at the limit never looks. The rig keys the turn at 0° and ±30° now, so that means around 15°.

There was also a second reference: the same character with its head turned, drawn by the image model with the front reference attached. The first one was a rough three-quarter view. It came back as a different drawing, with a different hair parting and a different collar, and at about 45° it asked for far more turn than the rig has. The rig's head turn stops at 30°, so the turned reference is now drawn at 30° ([`d303bd3`](https://github.com/zeikar/iki/commit/d303bd3)). Measured, the 45° drawing asked for about 1.7× the feature slide of the 30° one. The prompt names no hair or eye color, because the attachment carries the identity. It only describes the turn:

> a modest turn, NOT a three-quarter view and NOT a profile: both eyes still fully visible, the far (viewer's left) eye only slightly narrower than the near eye, the nose tip shifted a little toward the near cheek …

## A drawing of a turn isn't a spec for one

A drawn turn asks for more than a rig turn can give. Reviewers judging the rig against a three-quarter drawing asked for four times the nose movement it had, and at that much the features looked like stickers sliding on a plate ([`a92c107`](https://github.com/zeikar/iki/commit/a92c107)). A drawing shows a head rotating in 3D. A rig turn is layers sliding past each other, and it reads best at a fraction of what the drawing shows.

The 30° reference, too, started out as a source of numbers: the loop measured cues like the features' shift off it and handed them to the rig as targets. Now it's a style check. The critic judges the turn against it by eye, and the rig is no longer fitted to numbers taken from it. The rig starts every character from the same defaults, and the critic's questions about the turn map onto per-character knobs. Does the face turn as far as the reference's (the `turn` knob)? Do the features lead it as far (`featureLead`)? Does the hair follow as far (`hairFollow`)? Each answer is a free `retune` with a direction.

Even by eye, chasing the drawing overshoots. On the latest character, the critic found the bangs following the turn far less than the reference's, so the artist raised `hairFollow` to 2.0 and the `turn` knob to 1.25. The bangs then matched the reference, and the top of the front hair broke out up to 22 px past the back hair's outline. Round 3 took both back.

## The turn's fixes were in the drawing

The turn went the other way from that defect table. Several of its problems went away when the parts were drawn differently:

- The nose became its own part ([`a92c107`](https://github.com/zeikar/iki/commit/a92c107)). Painted on the face, it could only move with the face. Cut out, it can lead.
- The neck moved to the torso ([`e9eaba4`](https://github.com/zeikar/iki/commit/e9eaba4)). The face is drawn without one and slides as a whole over a neck that never turns.
- The front hair is drawn as wide as the face ([`b66d49c`](https://github.com/zeikar/iki/commit/b66d49c)), so its top can turn with the face. The first fix composed the back hair wider instead, and I rejected it at a glance: the head looked too big.

## Where it stands

Every run since the `turn` axis arrived, scored on eight axes, out of 40:

| Run | Total by round | `turn` by round |
|---|---|---|
| Plugin dogfood, Sep&nbsp;10 | 25&nbsp;→ 29&nbsp;→ 31 | 3&nbsp;→ 3&nbsp;→ 3 |
| Landing-page character, Oct&nbsp;1 | 26&nbsp;→ 30&nbsp;→ 30 | 3&nbsp;→ 4&nbsp;→ 4 |
| Second character, Oct&nbsp;3–4 | 26&nbsp;→ 28&nbsp;→ 30&nbsp;→ 31 | 3&nbsp;→ 3&nbsp;→ 3&nbsp;→ 3 |

None of them reached `ship`; each ended when the critic called `stop`. Every run stops at 30 or 31, and two of the three never got the turn past 3. The one that reached 4 finished with `rig` at 3. In the first, the critic described what it saw: the far eye stayed as wide as the near one and the face never narrowed. The turn was "the only sub-4 axis and it has not moved in three rounds."

I'm still the last critic: I noticed the neck, the turn and the hair before any score did. Right now I'm working on the front hair again. On a turn combined with a nod and a tilt, the top of the bangs can still slide past the back hair's outline.

The plugin bundles the skills, the agents and the MCP server ([source](https://github.com/zeikar/iki/tree/main/plugin)):

```
/plugin marketplace add zeikar/iki
/plugin install iki@iki
```

*This post first presented the measure-first geometry check and the `ship` bar (every axis at 4 or more) as changes made after the critic proved too kind. The commits show both were there from the first loop, and the first critic gave its 29 with both in place. In November 2026 I corrected the order.*
