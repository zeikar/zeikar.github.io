---
title: "Three Agents, One Document: A Claude Code Multi-Agent Doc Pipeline"
subtitle: "I split writing and reviewing an interview guide into separate agents and tied them together with parseable summary blocks and a hook, and the saved reviews show the grades still ran generous."
date: 2026-05-04
unit: backend-interview-guide
last_modified_at: 2026-11-18
lang: en
translations:
  ko: /blog/ko/three-agents-one-document/
description: "A Claude Code multi-agent doc pipeline: separate writer and reviewer roles, parseable Output Contracts, and a hook that catches what self-checks miss."
---

[backend-interview-guide](https://github.com/zeikar/backend-interview-guide) is a Korean backend interview reference with 69 documents across four categories: database, cloud, system design, and programming. It started in 2024 as 18 documents. In April 2026 I built a Claude Code harness first, then spent five days rewriting the old documents and filling in the rest. The `.claude/` setup is small: three agent definitions, four skills (the `interview-guide` orchestrator plus one per agent), and one hook. Each piece is there to stop one specific failure.

Hand one agent the drafting, the self-review, and the README index updates, and it leaks in three places. Reviewing its own output, it goes easy on itself. The index drifts out of sync without anyone noticing. And the output comes back in a different shape every run, so the orchestrator has nothing reliable to branch on. So `interview-guide` coordinates three agents instead: `content-writer`, `content-reviewer`, and `consistency-checker`. Three decisions in that split mattered most.

## A writer shouldn't review its own work

`content-writer` and `content-reviewer` share no conversational state. The only thing passed between them is the saved file. The writer drafts and saves, the orchestrator hands the path to the reviewer, and the reviewer reads the file fresh in its own context, with no idea how the draft was produced.

It's tempting to let one agent draft and then self-check before returning. It doesn't work. The writer is attached to its draft. It just produced 300-odd lines of Markdown, and asking it to find what's wrong is asking it to disagree with itself. In practice it finds nothing, or only nits, because critiquing the structure means admitting the structure it chose was off.

To the reviewer, the draft is just a file. It doesn't know what was easy or hard to write, so it has nothing to defend, and it compares the draft against the two longest documents in the same category. The grades come in three tiers, `상`, `중`, and `하` (roughly pass, polish, rewrite; the harness uses the Korean labels). A `상` has to meet every condition: no technical errors, a full path from concept to real-world scenario, enough depth to handle a "why?" follow-up, the same style as the existing documents, and no violations of the Writing Tips. Then the Failure Modes section of the agent definition adds this (translated):

```
IF the verdict is borderline (상/중 or 중/하):
  → grade down. When in doubt, be conservative.
```

Without that line, grades inflate. `상` requires every condition, but it's easy to wave one through, and an LLM picking a verdict on a fence case tends to pick the kinder one. Pushing borderline calls down to `중` (one revision) or `하` (rewrite) is what keeps the revision cycle running.

The line wasn't enough, though. Of the 18 review reports left in `_workspace/`, 16 are `상` and none are `하`. On April 7 I had GPT-5.4 review three of the documents a second time: Kafka, idempotency, and concurrency control. The Kafka draft that the default reviewer passed as `상` with zero Critical items got `중` with two from GPT-5.4. The draft defined lag against "the offset the consumer actually processed," mixing up committed offsets with the application finishing its work, and the source cited for `min.insync.replicas` was the Kafka 0.8.2 docs. The idempotency document also dropped to `중`, with one Critical item: it never covered the same key arriving twice at once. All three issues were fixed before the commit. A rule that says to grade down on borderline cases only works once the reviewer sees the problem. If it misses the error entirely, there's no borderline.

`consistency-checker` gets a different kind of fence. Its agent definition says (translated):

> Role boundary: fix link and structure issues directly. Only report missing content (content-writer's territory). Only report technical errors (content-reviewer's territory). If consistency-checker generates content itself, it bypasses content-writer's style analysis, AGENTS.md compliance, and interview-fit steps, and content with no quality guarantee gets added without review.

A document the README lists but that doesn't exist looks like a structure problem, and a capable consistency checker might simply write it. It's a content problem. Fixed by the wrong agent, it skips the writer's style analysis and the reviewer's grading, and documents nobody graded pile up.

## Output Contract: the ABI between agents

The orchestrator branches on the reviewer's verdict:

```
IF overall == "하":                              writer rewrites, then re-review (max 2 retries)
ELIF overall == "중" AND critical_count > 0:     writer applies one fix (no second review)
ELIF overall == "중":                            publish; report Enhancement notes only
ELIF overall == "상":                            publish
```

The single-fix case skips re-review on purpose. The reviewer writes a concrete fix suggestion for every Critical item, so applying them is mechanical rather than a new judgment, and when the writer finishes, the SubagentStop hook runs the link checker again.

That branch only works if the orchestrator can reliably pull `overall` and `critical_count` out of a free-form review. Asking an agent to state the grade clearly isn't enough. Sometimes it lands inside a list, sometimes as a section header, sometimes in the middle of a sentence.

So all three agents have an Output Contract. The reviewer's contract embeds a machine-parseable block in the human-readable Markdown:

```md
<!-- REVIEW_SUMMARY
overall: 상|중|하
accuracy: 상|중|하
interview_fit: 상|중|하
style: 상|중|하
critical_count: N
-->
```

The reviewer fills it in alongside the prose, and the orchestrator parses it. It's an HTML comment, so it doesn't render when a person skims `_workspace/{topic}/02_review.md`. The writer's `Writer Output` block (work type, target file, line count, main sections, and so on) and `consistency-checker`'s `<!-- CONSISTENCY_SUMMARY -->` work the same way.

A written contract still gets broken now and then. One review from the day the contract went in has a bullet list and no summary block, and the consistency checker run on GPT-5.4 filled `CONSISTENCY_SUMMARY` with sentences instead of `key: value` pairs. So the orchestrator has a fallback: if it can't read the block, it looks for the grade in the body, and if that fails too, it treats the review as `중` and asks a person to check.

## The hook runs the link check

Every agent carries a Self-Verification checklist. The writer's has ten items: front matter present, table-of-contents anchors matching real headings, tradeoffs covered, the new document linked from the README, and so on. It goes through them one by one before submitting.

For the first two days or so, the list also had a line asking whether the link-checker script had been run. You can get a report saying it ran, but the report alone can't tell you whether it actually did. An agent can match the shape of the report, skip the step, and still believe it checked. On April 7 I removed that line and moved the check into a hook:

```json
{
  "hooks": {
    "SubagentStop": [{
      "matcher": "content-writer|consistency-checker",
      "hooks": [{
        "type": "command",
        "command": "python3 scripts/check_markdown_links.py 1>&2 || exit 2",
        "timeout": 30
      }]
    }]
  }
}
```

When either agent finishes, Claude Code runs the link checker. On exit code 2 the agent can't stop: the checker's output comes back to it on stderr, and it has to fix the links first. Instead of a claim that the links were checked, there's the script's result. The reviewer isn't in the matcher. It doesn't edit documents, so there's nothing to check.

It's the cheapest safeguard in the harness. The checker is a 180-line Python script that goes through all 69 documents in under a tenth of a second, and in exchange nothing publishes with a 404 or a broken anchor.

`_workspace/{topic}/` is never deleted. It's in `.gitignore`, so it isn't committed, but the drafts, reviews, and structure reports pile up there by topic, which is where the grade counts and the Kafka review above came from.

The harness is small: three agents, four skills, one hook. What a machine can check, like output format and links, is enforced by structure. The quality of the review itself still rests on what one reviewer model manages to see.

---

*Code: [.claude/](https://github.com/zeikar/backend-interview-guide/tree/main/.claude). Project: [backend-interview-guide](https://github.com/zeikar/backend-interview-guide).*

*This post first said only that the "grade down when borderline" rule keeps grades from inflating. Going back through the review records in `_workspace/` in November 2026, I found they were mostly `상` and that a review on another model had caught errors the default reviewer missed, so I added that. I also corrected the document count, the checklist length, and the link checker's run time to the real numbers.*
