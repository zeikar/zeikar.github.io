---
title: "Why Naming a Claude Code Plugin Agent Rewrites Its Cache Every Round"
subtitle: "I measured why an autonomous loop burned through a 5-hour limit so fast, found an upstream bug, and dropping the one parameter behind it deleted most of the protocol I had written about three months earlier."
date: 2026-08-18
unit: hyperclaude
last_modified_at: 2026-11-18
lang: en
translations:
  ko: /blog/ko/protocol-working-around-a-bug/
description: "Passing name: to the Agent tool drops a plugin agent's definition, and a skill listing re-attached every round breaks the prompt cache. How 434 transcripts found it, and the two cache-TTL fixes that measurement talked me out of."
---

Three months ago I wrote up [five message races from hyperclaude's review loops](/blog/revise-loop-protocol/) and the protocol I built to stop them. As first published, that post ended on a general claim:

> Persistent teammates plus a long-running reviewer create races that prompt-only discipline cannot fix.

That claim was wrong, and it took a cost anomaly to find out.

## The symptom

[hyperclaude](/hyperclaude/) ([code](https://github.com/zeikar/hyperclaude)) runs autonomous loops: a Claude-side agent produces a plan, Codex reviews it, the agent revises, repeat until Codex stops flagging blockers. Running one of those loops chewed through my 5-hour usage limit far faster than a single session of the same length. Two hypotheses: the planner runs on a different model, or something is wrong with prompt caching.

Claude Code writes every session and subagent to `~/.claude/projects/**/*.jsonl`, and each assistant entry carries the raw `usage` block. That's a measurable question, not a vibe.

There were two gotchas, and I hit both. First, one API request is logged once per content block, so unless you dedupe by `message.id`, usage comes out two or three times too high. Second, cost weights matter more than token counts. In base-input-equivalents, a 5-minute cache write is 1.25x, a 1-hour write 2x, and a cache read 0.1x. A re-write costs 12.5 to 20 times what a cache hit does, so summing raw tokens points you at the wrong thing.

The model hypothesis died fast. Sorting by cache efficiency, the best write-to-read ratio in the whole corpus belonged to one-shot subagents on the same model as the planner. Model was uncorrelated. What correlated perfectly was something else.

## The mechanism

Every agent transcript has a sibling `*.meta.json`. Some carried `agentType: "myplugin:planner"`, the namespaced type I asked for. Others carried `agentType: "planner"`, the *name* I'd passed. Cross-tabbing 434 transcripts:

| agent definition | `skill_listing` attachments |
|---|---|
| resolved | **0 in 165/165** |
| lost | **>0 in 62/62** |

Zero overlap. And in the "lost" group, the attachment count equalled the round count exactly.

The A/B confirmed the chain. Passing `name:` to the Agent tool makes the spawned agent a team member, and the harness then drops the plugin agent's definition, `tools:` allowlist included. With the `Skill` tool back in scope, the harness attaches a skill listing of about 18KB, and then attaches the same listing again every round.

Re-attaching content into the middle of a conversation invalidates the prompt cache from that point. So every round re-wrote the agent's entire accumulated context. `cache_read` sat pinned at 13,818 tokens (the system prompt and tool definitions, nothing else) while writes climbed 131k → 228k over eight rounds, and 161k → 512k over nine in another run.

That is quadratic in round count. The loop wasn't expensive because it did a lot of work. It was expensive because it re-bought its own context every time it thought.

The A/B is one line: same agent, same prompt, one parameter.

```
subagent_type: "myplugin:planner", name: "probe"  →  skill_listing 1, deferred tools 56
subagent_type: "myplugin:planner"                 →  skill_listing 0, deferred tools  0
```

It's filed upstream twice ([#78234](https://github.com/anthropics/claude-code/issues/78234), [#81746](https://github.com/anthropics/claude-code/issues/81746)); one reporter traced it in Claude Code's own code to a source filter that discards plugin-scoped definitions. Project and user agent definitions survive a name. Only plugin agents lose theirs.

## Dropping the parameter deleted the protocol

Here's the part I didn't expect. `name:` is what makes an agent a *team member*, and being a team member is what gives it a mailbox. Spawn without it and the agent is a background task whose final text comes back as the task's own result. Later rounds go to the returned `agentId` through `SendMessage`, context intact. There is no mailbox, so there is nothing to route.

And routing was what the protocol was for.

Gone: the request-id state machine, the two-phase message classifier, the unsolicited-message backstop, `solicit_sent_at` and the stale-idle guard, the degrade layer, the teardown procedure, and the experimental-feature environment variable the loops used to require. The shared protocol file, `loop-protocol.md`, went from 192 lines to 39; counting the three per-loop `failure-protocol.md` files as well, from 453 to 246. The last post's "over 300 lines" was those two together, as of May. The transport change as a whole was net −730 lines.

What survived is the part that was never about transport: reply validation, corrective budgets, severity gates, review caps.

So the last post's protocol wasn't wrong. It was a correct solution to a transport that shouldn't have existed. Every race I documented really happened, but all of them happened inside the mailbox that one `name:` switched on. The same parameter was behind the cost bug.

## The two fixes measurement talked me out of

The transport change didn't fix everything. Subagents write their prompt cache with a 5-minute TTL while the main thread gets an hour, and a Codex review takes longer than five minutes. So the accumulated context still expires once per review-bearing round.

I nearly fixed that twice, and both times the numbers said no.

The first was forcing the longer TTL. The TTL comes from an allowlist of `querySource` values that no subagent matches, and there's an environment variable that forces the 1-hour TTL for everything. One line, done. Except a 1-hour write costs 2x base and a 5-minute write 1.25x, so breaking even needs expiry-driven writes to be 39% of all writes. Simulating across 480 transcripts put them at 13–19% however generously I classified, and the override came out 18% worse overall. Every bucket lost, including the multi-round agents it was supposed to help. The 60% surcharge lands on every write; the savings only land on the few that expired.

The second was a keepalive. A cache read refreshes the TTL at 0.1x, so pinging the agent mid-review should keep it warm cheaply. I had first written this off as needing a scheduler, and that was wrong: a backgrounded `sleep N; echo PING` hands its output back as a notification, which is an alarm clock with no scheduling logic anywhere in the prompt.

The mechanism was fine. The value wasn't. Across 105 observed expiry boundaries, capping refreshes at the optimum (three) saves about 5% of subagent cost, roughly 1% of the whole session, and 21 of those 105 boundaries still spend the budget and expire anyway, because when you schedule the refresh you don't know whether the gap will be five minutes or an hour. Uncapped, it's a disaster: sixteen gaps ran over an hour, and bridging one of those takes more than fifteen refreshes, each reading the full context. Net −18%.

Both of those would have shipped on intuition. The first one I was actively optimistic about.

After release I measured one real plan-loop run, and the new transport held. Across four review rounds `skill_listing` stayed at 0, and at round boundaries under five minutes `cache_read` came in at 89k–132k instead of pinned at 13,818. The prefix survives. One boundary of the eight ran 354 seconds, past the TTL, and there `cache_read` fell to 5,192 while 80k was re-written: exactly the cost I had measured and chosen to leave in place.

*In September 2026 I reversed the TTL call for one agent. Claude Code 2.1.248 added `experimental.cacheTtl` to subagent frontmatter, so the plan-loop's planner, the one agent that crosses a review boundary every round, now writes its cache with the 1-hour TTL. On a real seven-round run that cut planner cost by about 10%. Forcing the 1-hour TTL on every request through the environment variable is still a loss.*
