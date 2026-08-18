---
title: "How My Agent-Team Revise Loop Earned a 300-Line Protocol"
subtitle: "Five dogfooded failure modes that turned twenty lines of pseudocode into a state machine — inside hyperclaude's plan-loop and implement-loop."
date: 2026-05-22
lang: en
translations:
  ko: /blog/ko/revise-loop-protocol/
description: "Why hyperclaude's persistent-teammate revise loops grew a long cross-loop protocol — request-id counters, solicit_sent_at timestamps, and the 1-round-lag race that ate an afternoon."
---

> **Update (2026-08-18):** Most of this protocol no longer exists. Measuring why these loops were so expensive turned up an upstream bug — one Agent-tool parameter was silently dropping the plugin agent's definition, and that is what created the mailbox all of these races lived in. Removing it took the shared protocol from 192 lines to 39. The failures below were real; the conclusion at the end was not. → [My 300-Line Agent Protocol Was Working Around One Parameter](/blog/protocol-working-around-a-bug/)

This is about the autonomous revise loops in [hyperclaude](/hyperclaude/) ([code](https://github.com/zeikar/hyperclaude)) — a Claude Code plugin built around a deliberate split: Claude builds, Codex critiques. Two of its skills, `hyper-plan-loop` and `hyper-implement-loop`, take a task and run plan → review → revise (or implement → review → fix) on their own, looping until Codex returns no blocking findings or a hard cap is hit. A single Claude-side teammate stays alive across rounds; Codex stays the reviewer.

If you sketch that on a whiteboard, it's twenty lines:

```
spawn teammate
loop:
  reply = teammate.produce()
  result = codex.review(reply)
  if result.clean: break
  send(teammate, result.findings)
teardown
```

The actual SKILL.md plus shared reference is north of 400 lines. Almost none of that growth was planned — it was bugs found by dogfooding that prompt-only discipline could not survive. This post walks through five of them, roughly in the order they bit me.

## The naive loop has more failure modes than lines

Two properties of Claude Code's experimental agent-teams runtime matter for everything below.

A teammate kept idle between turns keeps its **process and full context alive**. That is the entire reason these loops exist — re-spawning a fresh planner each round would lose the context the planner just accumulated. Persistent teammate, bounded review loop.

The lead only acts on **deliveries** — a teammate reply, an idle notification, a bridge result. There is no poll/wait primitive. If the lead misclassifies a delivery, the loop hangs or self-confuses; it cannot just "check again."

Both properties cut both ways. Persistence lets useful context survive across rounds; it also lets stale messages from prior rounds survive. The delivery-only model means every wake is load-bearing; it also means a misrouted wake has nowhere else to go. Every failure below sits at that intersection.

## #1 — The plain-text reply is invisible

The first version of the planner ended its turn like this:

```
WROTE: .hyperclaude/plans/20260522-1430-foo.md
```

— printed as plain text in its own assistant turn, followed by going idle. The lead is supposed to read `WROTE: …` and proceed. Easy.

Wrong. When a teammate goes idle, the lead receives a payload-less wake: `{type: "idle_notification", ...}`. **The teammate's plain text is not in there.** The notification confirms idle happened; it carries no body. Whatever the teammate printed to its own transcript stays in the teammate's transcript — invisible to the lead's mailbox.

The fix is structural: replies must travel by `SendMessage`. The planner's spawn prompt now says, in many words, "first call `SendMessage({to: 'team-lead', message: 'WROTE: <id> <path>'})`, *then* idle." Plain assistant text is allowed but ignored. The `SendMessage` call is the contract.

That alone wasn't enough to make idle handling sane. Replies-via-SendMessage and idle-as-wake-signal are independent patterns; both need their own rules. Everything below #1 is the idle half.

## #2 — During a five-minute Codex review, anything can show up in the mailbox

`plan-review` runs in a fresh `codex exec` subprocess and can take five to ten minutes on a non-trivial plan. The lead spends those minutes blocked on a single Bash call.

During that window, the teammate is idle, but the messaging runtime is not. Two kinds of garbage kept arriving:

A **re-emit of the previous round's reply**. Cause varied — sometimes a `RESEND:`-style nag pattern crept into the spawn prompt, sometimes a teammate woken from idle by an earlier corrective re-sent its prior reply. The effect was the same: when the lead came back from Codex, the mailbox held a `WROTE: …` that *looked* like the answer to the round it just finished, but was actually the answer to two rounds ago.

A **stale `idle_notification` from the prior round**. The teammate finished its reply and went idle. The idle wake was queued. The lead spent five minutes on Codex. When the lead resumed and *then* sent the next solicitation, the queued idle could still arrive AFTER the solicitation went out — landing as if it were the teammate's response to the new solicitation, which it cannot possibly be.

Same bug family: a delivery from round N showing up in round N+1's slot. Without something to tell them apart, the loop accepts garbage as success — or escalates a "missing reply" corrective because the only delivery it can see is stale.

The fix for the first flavor is a **request-id counter**. Every solicitation the lead sends carries a monotonically increasing integer; the teammate echoes it verbatim in `WROTE: <id> <path>`. The lead is the *sole* id source. An incoming reply with `id < expected` is, by definition, stale — ignore content, stay waiting for the real reply. An id greater than expected is impossible (lead-owned) and is a protocol violation — teardown and stop.

The counter is one integer. The pattern it fixes — "during a long blocking step, deliveries from prior rounds can race the current one" — outlives this specific loop.

## #3 — `idle.timestamp` vs. `solicit_sent_at`, the 1-round-lag race

The id counter handles `WROTE:` replies. It doesn't handle idle notifications, which carry no id.

In dogfooding, this race surfaced repeatedly:

1. Round N: teammate replies, then idles. Reply is delivered first; idle is queued.
2. Lead accepts the reply, runs Codex (five-plus minutes).
3. Codex returns Major findings. Lead mints round N+1, sends.
4. **Now** the queued idle from step 1 arrives.
5. Lead is awaiting round N+1's reply and sees an idle. Naive logic: "teammate idled without replying — corrective round-trip."
6. Lead mints a fresh-id corrective, sends. Teammate, still working on round N+1, now has *two* outstanding solicitations queued in its mailbox.
7. Teammate replies to round N+1 first. From the lead's view, the id is for the *original* round N+1, not the corrective — so it looks stale. Lead mints yet another corrective.
8. The loop never converges. Each round produces an idle that arrives one round late; each one kicks off another corrective.

The 1-round-lag race. It chewed an afternoon of dogfooding before the cause was clear.

The fix is a **timestamp guard**. Right before each `SendMessage`, the lead captures `solicit_sent_at` via Bash `date -u +%FT%TZ`. The `idle_notification` payload carries the teammate's `idle.timestamp` — wall-clock at which the teammate *actually* went idle. If `idle.timestamp < solicit_sent_at`, the idle cannot possibly be a response to the current solicit. Ignore silently; stay waiting.

That guard sits in the protocol for a reason that generalizes: in any persistent-teammate loop with a long-running blocking step in between rounds, you need timestamps anchored at the lead's send, not at the teammate's reply. Otherwise prior-round deliveries will impersonate the current round's.

## #4 — `assistant-turn-start` is not a substitute for `date -u` right before send

The seductive shortcut here is to use the lead's current turn-start time as `solicit_sent_at`. It's "free" — already in the context — and it's *almost* right.

It's not right. A single lead turn can:

1. Start at wall-clock `T`.
2. Receive Codex review JSON over five minutes.
3. Mint a fresh id.
4. Send the next solicitation, at wall-clock `T + 5min`.

A queued idle from a prior round with `idle.timestamp = T + 2min` slots neatly between turn-start and actual-send. Comparing to `T` says "this idle came after my round started, so it must be a response to my new solicit." It can't be — the `SendMessage` for that solicit hadn't happened yet.

The protocol requires `date -u` as the **last tool call before `SendMessage`**, every time. The spec wording — *"the field-definition rule above is binding — assistant-turn start is NOT valid"* — exists because someone (me) tried to optimize the Bash call away and reintroduced the race.

This is the smallest concrete fix in the protocol. It is also the one that took me longest to believe.

## #5 — `expected_request_id == null` collapse

By the time you have a request-id counter and a timestamp guard, you have two state variables that interact: `expected_request_id` (the id the lead is waiting on, or `null`) and `awaiting_reply` (boolean). The merge temptation is real — *isn't `expected_request_id == null` the same as `awaiting_reply == false`?*

Same at the value level. Not the same at the *classification* level. There are two phases:

**Phase 1** (`awaiting_reply == false`): the lead is not waiting on anything. A `WROTE:` arriving in this phase is, by definition, stale or duplicate — there is no current id to match. Compare to `request_id_counter` (the last id ever minted), not to `expected_request_id` (which is `null`). If you collapse the phases, you're either comparing against `null` mid-classification or you're feeding a stale duplicate into the same accept logic that handles fresh replies — and silently treating each one as either a violation or a success depending on which null-check you put first.

**Phase 2** (`awaiting_reply == true`): the lead is specifically waiting on `expected_request_id`. Now `reqid < expected_request_id` is a stale leftover (ignore + stay waiting), `reqid == expected_request_id` is the candidate genuine reply (run the accept rule), `reqid > expected_request_id` is impossible (teardown).

The two phases route deliveries through different rules — and one of those rules is a *silent ignore*. Skip the phase split and you either keep escalating on stale duplicates (the loop never converges) or you accept stale ones as the answer (the loop converges on the wrong content).

The lesson generalizes beyond this loop: when you have a state machine with a busy state and an idle state, and inputs arrive in both, the routing logic for each state has to be authored separately. The "they look the same, let's merge" instinct is exactly what makes long-running async protocols fragile.

## What this protocol actually is

Every section above buys back one specific dogfooded failure. The reviewer (Codex) is long-running. The teammate is persistent. The runtime delivers messages and idle wakes; the lead routes them. The protocol *is* the routing table, and every entry exists because routing it any other way produced a bug I watched happen.

That is also what stops the protocol from being elegant. It's the precipitate of failures, not a coherent design from first principles. Two cross-loop sections — `§E` (the request-id state machine) and `§B` (unsolicited messages) — collect the parts shared by `plan-loop` and `implement-loop`. Each loop's local `failure-protocol.md` then binds the loop-specific bits: reply-token shape (`WROTE: <id> <path>` vs. `DONE: <id> <task>`), accept regex, post-acceptance validation.

If I were starting over: the request-id counter, `SendMessage` transport for replies, and the `solicit_sent_at` timestamp eat about 80% of the failure surface. The rest is fence-posting — phase splits, unsolicited-message backstops, teardown ordering — the kind of thing you only realize is necessary after the obvious version breaks at 2 a.m.

The general shape, lifted out of hyperclaude: **persistent teammates plus a long-running reviewer create races that prompt-only discipline cannot fix.** The lead has to own ids, own timestamps, and treat every delivery as a router input — not an answer to whatever it sent most recently. Once that mental model is in place, the rest is bookkeeping.
