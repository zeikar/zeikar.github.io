---
layout: project
title: "tangent"
description: "Studio where Claude Code agents make Korean math and science Shorts, from topic to upload file, with code-rendered Remotion animation and a human approving at checkpoints."
tech_stack: ["Claude Code agents", "Remotion", "TypeScript", "KaTeX", "Gemini TTS", "Codex CLI", "Python", "Vitest"]
github_url: "https://github.com/zeikar/tangent"
demo_url: "https://www.youtube.com/channel/UCQyrXQkYvmwkQ2W8oaQEy1w"
image: "/assets/images/projects/tangent.png"
sequence: 9
gadget_no: 22
---

tangent makes short explainers in the 3Blue1Brown vein: one visual insight per Short, with every shape, equation and graph drawn in code. Claude Code agents do the production, one per stage, and a human approves at checkpoints. It runs the Korean channel [루트와이 (√y, "root why")](https://www.youtube.com/channel/UCQyrXQkYvmwkQ2W8oaQEy1w), whose first two Shorts asked [why A4 paper is 210×297](https://youtube.com/shorts/nlG5vMoo5w0) and [why the Moon always shows the same face](https://youtube.com/shorts/WDywGPVblfU). The agent system is half the point: each milestone logs which stage held things up, and that stage gets automated next.

## Specialist agents, and only files between them

An episode is a chain of handoff files: `topic.md`, a sourced `research.md` with a `verify.py` for its numbers, two script variants and their narration takes, the picked script and take, word timestamps, `storyboard.json`, beat cues, the render, `review.md` and `publish.md`. Seven agents in `.claude/agents/` own the stage groups. Each is a fresh subagent that reads the previous files and writes its own, so any stage can be re-run, edited by hand or held for a human. Narration takes and word alignment need no judgment, so they're plain tools the orchestrator runs. The main conversation orchestrates through an `episode` skill and stops at five checkpoints: topic, script and take, storyboard, first render, and final cut with its upload metadata. Each is something to hear or watch (a takes page, a storyboard viewer, the video), and the decision is recorded in the human's own words.

Most of the roles came out of making the first episode by hand:

- **Two writers draft each script independently**, so one draft can't mix up the human's taste with the luck of a single sample. Takes cost a minute each, and the pick is made by ear.
- **Once production starts, one agent owns every fix**, spec and code alike, and renders itself; only a change to what is said goes back through the script agent. With two fixers, relaying what one had learned to the other took about 12 messages in one round and caused a render race.
- **The writers, storyboard and production agents can't spawn reviewers of their own**, which would compete with the critics and QA.

QA has never been the agent that built the scenes, and QA and publish get no web access.

## Animation timed to words, not seconds

The stack is Remotion, since LLMs write React well, it handles Korean type, KaTeX and 9:16 captions, and it renders a single frame in under 2 seconds for the review loop. Equation steps are KaTeX token morphs, where shared tokens slide and the rest fade, so the Manim fallback hasn't been needed. A generic player animates the storyboard's data with primitives from a component library under a style guide. When an episode needs a new picture, production adds a general primitive (eight for episode 002) rather than one-off animation code, because layout (overlaps, things off-frame) is where agent-written animation usually fails.

Narration is Gemini TTS at 1.08×. Gemini returns no timestamps, so a local MMS forced aligner finds each word, with starts within about 40 ms, roughly one frame. The aligner only matches Hangul, so every script keeps a read-aloud version with numbers and formulas spelled out (x² → 엑스 제곱). Cues bind each animation to a word, and no timing is set by hand. When episode 002 was retaken twice, re-syncing the storyboard only moved cue anchors to the new words.

Git holds text only. Every media file can be regenerated from the committed text, but a new take is equivalent rather than identical, so each approved episode's exact video, original take and mixed narration go to a GitHub Release tagged with its slug.

## Checks for the pixels, critics for the story, a human for the feel

In the first episode, the slow part was the loop after the first render: about 2.5 hours over three QA rounds, all of it layout defects found by measuring frames by hand each round. That became `check-render`, which reads exact geometry from the player's probe mode. It began as 11 checks in about 10 seconds that QA judged would have caught 7 of the 10 defects, and has since grown to 16 with the ones QA said were missing, such as label ownership and caption timing. A check whose number changed between two renders exposed text measured before its font had loaded, so renders are now deterministic and rendering twice is part of the brief.

For what checks can't measure there are two outside critics, Codex and a fresh Claude, read-only and in parallel with the same brief. They review each script variant and the first render, and a point both raise weighs more. Their findings are advice, not gates, and each stage gets at most two critique rounds, since a critic always finds something.

The first episode showed why they only advise. Codex called v1 "a tidy 51 s math lecture, not a curiosity Short," and no Claude agent had noticed. A v2 rewrite that followed the critique like a checklist passed every check and still lost to v1 on feel. Checks and critics measure proxies, so the human now watches the first render before any critique-driven polish, and the writing brief went from a structure checklist to principles with reasons.

## Where it stands

Milestone 2, in active development. The next stage to automate is whatever the next episode shows is slowest. Everything that moves is rendered in code, with no video-generation models, and image generation is kept for static illustrations. Korean comes first, with an English channel set up and waiting. English is meant to stay cheap to add: on-screen text lives apart from scene code and timing binds to beats, so a translation needs a new take and a re-render. Code and docs are MIT; the episodes are not.
