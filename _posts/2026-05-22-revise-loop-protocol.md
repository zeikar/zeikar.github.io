---
title: "Five Message Races in a Claude Code Agent-Team Review Loop"
subtitle: "hyperclaude's review loop started as seven lines of pseudocode and picked up a rule every time dogfooding broke it, until the protocol ran past 300 lines."
date: 2026-05-22
unit: hyperclaude
last_modified_at: 2026-11-18
lang: en
translations:
  ko: /blog/ko/revise-loop-protocol/
description: "Five ways the lead in hyperclaude's plan-loop and implement-loop misread its teammate: an invisible plain-text reply, stale replies piling up during Codex review, idle notifications arriving one round late, the turn-start timestamp trap, and two phases that must not be merged."
---

> **Update (2026-08-18):** Most of this protocol no longer exists. Measuring why these loops were so expensive turned up an upstream bug: passing `name` to the Agent tool silently drops a plugin agent's definition, and the same parameter makes the agent a team member, which is what opens the mailbox. Every race below happened in that mailbox. Dropping `name` took the shared protocol from 192 lines to 39. The failures below were real, but the cause was that parameter, not the loop design. → [Why Naming a Claude Code Plugin Agent Rewrites Its Cache Every Round](/blog/protocol-working-around-a-bug/)

[hyperclaude](/hyperclaude/) ([code](https://github.com/zeikar/hyperclaude)) is a Claude Code plugin built around a split: Claude builds, Codex critiques. Two of its skills, `hyper-plan-loop` and `hyper-implement-loop`, take a task and run plan → review → revise (or implement → review → fix) on their own, stopping when Codex returns no Blocker or Major findings or the review cap is hit. A single Claude-side teammate (`planner` in plan-loop, `fixer` in implement-loop) stays alive across rounds; Codex is always the reviewer.

Sketched on a whiteboard, it's seven lines:

```
spawn teammate
loop:
  reply = teammate.produce()
  result = codex.review(reply)
  if result.clean: break
  send(teammate, result.findings)
teardown
```

As of this writing, plan-loop's SKILL.md plus the shared reference is over 400 lines, and the protocol files alone (the shared reference plus each loop's failure protocol) run past 300. Almost none of that was planned. It piled up from bugs found while dogfooding that prompts alone couldn't stop. This post covers five of them. The first three are runs that stalled or went somewhere wrong; the last two are traps that are easy to fall into while putting those fixes in.

## The naive loop has more failure modes than lines

Two properties of Claude Code's experimental agent-teams runtime sit under everything below.

First, a teammate left idle between rounds **keeps its process and context alive**. That is why these loops exist: re-spawning the planner every round would throw away the context it just built. So the teammate stays alive, and the number of reviews is capped.

Second, the lead acts only on **what gets delivered**. Teammate messages and idle notifications arrive as new turns; there is no poll or wait primitive. If the lead misclassifies a delivery, the loop stalls or tangles itself. It can't just check again.

Both properties cut both ways. A live teammate keeps useful context, and it also keeps stale messages from earlier rounds. Acting only on deliveries means every wake has a reason, and also that a misrouted delivery has nowhere else to go. Every failure below sits where the two meet.

## #1. The lead can't see a plain-text reply

The first version of the planner ended its turn like this:

```
WROTE: .hyperclaude/plans/20260517-0930-foo.md
```

It printed that as plain text in its own assistant turn and went idle. The lead was supposed to read `WROTE: …` and move on.

It couldn't. When a teammate goes idle, the lead gets a payload-less notification, `{type: "idle_notification", ...}`. **The teammate's plain text is not in it.** The notification says idle happened and carries no body; whatever the teammate printed stays in the teammate's transcript. The transcript showed the lead receiving only the empty idle notification and falling back to a corrective round-trip.

The fix was structural: replies must go through `SendMessage`. The planner's spawn prompt gained a mandatory item: "first call `SendMessage({to: 'team-lead', message: 'WROTE: <id> <path>'})`, then go idle." Plain text is allowed but ignored; the `SendMessage` call is the contract. Making the contract a machine-read format rather than human-read output is the same idea as the Output Contract in the [document pipeline post](/blog/three-agents-one-document/).

That didn't fix idle handling. "Replies go through SendMessage" and "idle is only a wake signal" are separate problems that need separate rules. Everything after this is about idle.

## #2. During a Codex review, anything can land in the mailbox

`plan-review` runs as a Codex subprocess and takes minutes, long enough that the Bash timeout is set to ten. For that whole time the lead is stuck on one Bash call.

The teammate is idle, but the messaging runtime isn't. Two kinds of things piled up in that window: re-sends of the previous round's reply, and the previous round's idle notification arriving late. The idle half is #3.

Re-sends first. Originally the planner sent the plan body back as a message, and while waiting on Codex review it would send the body again, re-send it marked `RESEND:`, or nag for a response. So the planner switched to writing the plan file itself and replying with a single `WROTE:` line, and the spawn prompt told it not to resend and to wait. The prompt alone didn't stop all of it, so the lead got its own rule: on an unsolicited message, ignore the content and send one "stay idle until contacted" message. If another one of the same kind arrives, tear down.

The one-line reply still had a problem. The plan is overwritten at the same path every round (the Codex review's `--resume` is keyed on that path), so the previous round's `WROTE: <path>` is byte-identical to this round's. In a run planning a static landing page, the lead sent a revise request, took the stale `WROTE:` that arrived next as this round's reply, and moved on with a plan file that didn't include the revision.

That's the bug: a delivery from round N showing up in round N+1's slot. With nothing to tell them apart, the loop either accepts a stale reply as success or, when everything it can see is stale, keeps sending "missing reply" correctives.

The fix is a **request-id counter**. Every request the lead sends carries a monotonically increasing integer, and the teammate echoes it in `WROTE: <id> <path>`. Only the lead mints ids. A reply with an id lower than the one the lead is waiting on is stale: ignore the content and keep waiting for the real one. An id higher than that can't happen, so it's a protocol violation: tear down and stop.

## #3. Idle notifications that arrive one round late

The id counter sorts out `WROTE:` replies. Idle notifications carry no id, so it can't sort those.

Running the version with the counter on another project, this race went off. Times are UTC.

1. The planner sends `WROTE: 1` and goes idle at 21:53:18. The reply is delivered first; the idle notification stays queued.
2. The lead accepts the reply and runs Codex review for three and a half minutes.
3. At 21:57:03 the lead sends the revise request (id 2).
4. Three seconds later, the idle notification queued in step 1 arrives as the lead's next turn.
5. The lead is waiting on id 2's reply and sees an idle. It even noticed the idle looked off, but the rule at the time said "a delivery without an id means corrective." So it minted id 3 and sent a corrective.
6. The planner is still working on id 2. It finishes and sends `WROTE: 2`, but the lead is now waiting on 3, so it discards that as stale. The idle that follows gets another corrective.

The planner's replies stayed one id behind what the lead was waiting for, every round. The run tore down at id 5 without applying a single revision.

The fix is a **timestamp guard**. Right before every `SendMessage`, the lead runs `date -u +%FT%TZ` through Bash and stores it as `solicit_sent_at`. The `idle_notification` carries `idle.timestamp`, the time the teammate actually went idle. If `idle.timestamp < solicit_sent_at`, that idle can't be a reaction to the current request: ignore it silently and keep waiting. The reference point is when the lead sent, not when the teammate replied.

## #4. Turn-start time is no substitute for `date -u` right before the send

The tempting shortcut is to use the time the lead's current turn started as `solicit_sent_at`. It's already in context, it saves a Bash call, and it's almost right.

Almost right isn't right. One lead turn can go like this:

1. Start at time `T`.
2. Spend five minutes getting the Codex review back.
3. Mint a new id.
4. Send the next request at `T + 5min`.

An idle notification from the previous round with `idle.timestamp = T + 2min` falls right between turn start and the actual send. Compared against `T`, the lead concludes "this idle came after my turn started, so it's a reaction to the new request." But that request's `SendMessage` hadn't happened yet. The race from #3 is back.

So from the moment the guard went in, the protocol required `date -u` to be **the last tool call before `SendMessage`**, and the shared reference and both loops' SKILL.md files repeat *"assistant-turn start is NOT valid"*. The moment the model tries to save that one Bash call, the guard stops working.

## #5. Merging the phases on `expected_request_id == null`

Adding the request-id counter brings two state variables that interact: `expected_request_id`, the id the lead is waiting on (`null` when it isn't waiting), and the boolean `awaiting_reply`. The urge to merge them is real. Isn't `expected_request_id == null` just `awaiting_reply == false`?

As values, yes. As rules for classifying what arrives, no. There are two phases.

**Phase 1** (`awaiting_reply == false`): the lead isn't waiting on anything, usually because it's running Codex review. A `WROTE:` arriving now is stale or a duplicate. Compare it against `request_id_counter`, the last id ever minted, not `expected_request_id` (which is `null`). At or below the counter, ignore it silently; above it, it's a violation.

**Phase 2** (`awaiting_reply == true`): the lead is waiting on exactly `expected_request_id`. Now `reqid < expected_request_id` is stale (ignore, keep waiting), `reqid == expected_request_id` is the candidate genuine reply (run the accept rule), and `reqid > expected_request_id` is impossible (tear down).

Fold the two phases into one comparison and you either compare against `null` in Phase 1 or feed a duplicate that arrived during review into the same accept logic as a fresh reply. Then, depending on where the null check sits, the same duplicate gets treated as a violation or as a success. That's why the shared reference lists "collapsing Phase 1 and Phase 2 into a single comparison" as its own anti-pattern.

## The protocol both loops share

The race plan-loop had just been fixed for existed in implement-loop in the same shape. So right before this post, the common parts moved into a shared reference, `loop-protocol.md`. `§E` holds the request-id state machine and the state variables above; `§B` handles unsolicited messages. Each loop's `failure-protocol.md` fills in that loop's values. The planner replies with a single `WROTE: <id> <path>` line; the fixer replies with structured findings blocks whose first line is `request-id: <id>`. The accept rule and the check after a reply is accepted (a structure check on the plan file, matching each finding to how it was handled) also differ per loop.

*This post originally ended on the conclusion that "persistent teammates plus a long-running reviewer create races that prompt-only discipline cannot fix." As the [follow-up](/blog/protocol-working-around-a-bug/) explains, the mailbox those races happened in was created by the Agent tool's `name` parameter, and removing it removed the races. In November 2026 I cut that conclusion and the generalizations that closed several sections.*
