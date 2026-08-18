---
title: "My 300-Line Agent Protocol Was Working Around One Parameter"
subtitle: "I measured why an autonomous loop burned a 5-hour limit so fast, found an upstream bug, and deleting the bug deleted most of the protocol I'd just written about."
date: 2026-08-18
lang: en
translations:
  ko: /blog/ko/protocol-working-around-a-bug/
description: "434 local transcripts, one Agent-tool parameter, and a 192-to-39-line deletion — plus the two 'fixes' that measurement talked me out of."
---

Three months ago I wrote about [the 300-line protocol my revise loops earned](/blog/revise-loop-protocol/) — request-id counters, `solicit_sent_at` timestamps, a two-phase message classifier, a degrade layer. Every section bought back a specific failure I had watched happen. I ended it with a general claim:

> Persistent teammates plus a long-running reviewer create races that prompt-only discipline cannot fix.

That claim was wrong, and it took a cost anomaly to find out.

## The symptom

[hyperclaude](/hyperclaude/) ([code](https://github.com/zeikar/hyperclaude)) runs autonomous loops: a Claude-side agent produces a plan, Codex reviews it, the agent revises, repeat until Codex stops flagging blockers. Running one of those loops chewed through my 5-hour usage limit dramatically faster than a linear session of the same length. Two hypotheses: the planner runs on a different model, or something is wrong with prompt caching.

Claude Code writes every session and subagent to `~/.claude/projects/**/*.jsonl`, and each assistant entry carries the raw `usage` block. That's a measurable question, not a vibe.

Two gotchas, both of which I hit:

- **Dedupe by `message.id`.** One API request is logged once per content block, so counting lines multiplies usage by two or three.
- **Cost weights matter more than token counts.** In base-input-equivalents: a 5-minute cache write is 1.25x, a 1-hour write 2x, a cache **read is 0.1x**. A re-write costs twenty times what a cache hit costs. Any analysis that sums raw tokens will point the wrong way.

The model hypothesis died fast. Sorting by cache efficiency, one-shot subagents on the *cheap* model had the best write-to-read ratio in the whole corpus. Model was uncorrelated. What correlated perfectly was something else.

## The mechanism

Every agent transcript has a sibling `*.meta.json`. Some carried `agentType: "myplugin:planner"` — the namespaced type I asked for. Others carried `agentType: "planner"` — the *name* I'd passed. Cross-tabbing 434 transcripts:

| agent definition | `skill_listing` attachments |
|---|---|
| resolved | **0 in 165/165** |
| lost | **>0 in 62/62** |

Zero overlap. And in the "lost" group, the attachment count equalled the round count exactly.

The chain, once I had the A/B to confirm it: passing `name:` to the Agent tool makes the spawned agent a team member, and the harness then drops the plugin agent's definition — including its `tools:` allowlist. With the `Skill` tool back in scope, the harness attaches an ~18KB skill listing. Then it re-attaches the *same* listing on every round, because the "already sent" state doesn't survive re-invocation.

Re-attaching content into the middle of a conversation invalidates the prompt cache from that point. So every round re-wrote the agent's entire accumulated context. `cache_read` sat pinned at 13,818 tokens — the system prompt and tool definitions, nothing else — while writes climbed 131k → 228k over eight rounds, and 161k → 512k over nine in another run.

That is quadratic in round count. The loop wasn't expensive because it did a lot of work. It was expensive because it re-bought its own context every time it thought.

The A/B is one line: same agent, same prompt, one parameter.

```
subagent_type: "myplugin:planner", name: "probe"  →  skill_listing 1, 56 tools
subagent_type: "myplugin:planner"                 →  skill_listing 0,  0 tools
```

It's filed upstream twice ([#78234](https://github.com/anthropics/claude-code/issues/78234), [#81746](https://github.com/anthropics/claude-code/issues/81746)); one reporter had disassembled the binary and found the source filter that discards plugin-scoped definitions.

## Deleting the bug deleted the protocol

Here's the part I didn't expect. `name:` is what makes an agent a *team member* — which is what gives it a mailbox. Spawn without it and the agent is a background task, so its final text comes back as the task's own result. There is no mailbox, so there is nothing to route.

And routing was what the protocol was for.

Gone: the request-id state machine, the two-phase message classifier, the unsolicited-message backstop, `solicit_sent_at` and the stale-idle guard, the degrade layer, the teardown procedure, and the experimental-feature precondition the loops used to require. The shared protocol file went from **192 lines to 39**. The whole change was net −730 lines.

What survived is the part that was never about transport: reply validation, corrective budgets, severity gates, review caps.

So the last post's protocol wasn't wrong. It was a correct solution to a transport that shouldn't have existed. Every race I documented was real — I watched them happen — but they were downstream of a definition being silently discarded. That's an uncomfortable kind of correct: the fix wasn't in the layer where the symptoms were.

## The two fixes measurement talked me out of

The transport change didn't fix everything. Subagents write their prompt cache with a **5-minute TTL** while the main thread gets an hour, and a Codex review takes longer than five minutes. So the accumulated context still expires once per review-bearing round.

I nearly fixed that twice, and both times the numbers said no.

**Attempt one: force the longer TTL.** The TTL comes from an allowlist of `querySource` values that no subagent matches, and there's an environment variable that overrides it for everything. One line, done. Except a 1-hour write costs 2x base and a 5-minute write 1.25x — so break-even needs expiry-driven tokens to be **39%** of all write tokens. Simulating across 480 transcripts put them at 13–19% depending on how generously I classified, and the override came out **18% worse overall**. Every bucket lost, including the multi-round agents it was supposed to help. The 60% surcharge lands on every write; the savings only land on the few that expired.

**Attempt two: a keepalive.** A cache read refreshes the TTL at 0.1x, so pinging the agent mid-review should keep it warm cheaply. I'd previously written this off as needing a scheduler — wrong, and worth correcting: a backgrounded `sleep N; echo PING` hands its output back to the lead as a notification, which is an alarm clock with no scheduling logic anywhere in the prompt.

The mechanism was fine. The value wasn't. Across 105 observed expiry boundaries, capping refreshes at the optimum nets about 5% of subagent weight — roughly **1% of session weight** — and 21 of those 105 boundaries still spend the budget and expire anyway, because when you schedule the refresh you don't know whether the gap will be five minutes or an hour. Uncapped, it's *catastrophic*: sixteen boundaries were over an hour, and bridging one of those needs fifteen-plus refreshes each reading the full live context. Net −18%.

Both of those would have shipped on intuition. The first one I was actively optimistic about.

## The general shape

The revised claim, replacing the one I got wrong:

**Before you build a protocol to survive a system's behavior, measure whether that behavior is intended.** I spent an afternoon on a 1-round-lag race and wrote it up as a law of persistent agents. It was a symptom of a parameter I shouldn't have been passing.

And the corollary, which is really about the cost weights: **in a cached system, the expensive operation is invisible in token counts.** Everything I needed was sitting in local JSONL files the whole time. The measurement that actually settled it — cross-tabulating a metadata field against an attachment count — took a few minutes once I knew to look, and it invalidated three months of my own conclusions.

Post-release dogfooding says the transport holds: `skill_listing` 0 across a real run, and at round boundaries `cache_read` now sits at 89k–132k instead of pinned at 13,818. The prefix survives. The 5-minute TTL is still there, still measured, and deliberately left alone.
