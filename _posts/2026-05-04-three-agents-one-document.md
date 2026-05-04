---
title: "Three Agents, One Document: A Claude Code Multi-Agent Doc Pipeline"
subtitle: "A lightweight content pipeline for a Korean backend interview guide — why splitting writer, reviewer, and consistency-checker beats a single all-in-one agent."
date: 2026-05-04
lang: en
translations:
  ko: /blog/ko/three-agents-one-document/
description: "Building a Claude Code multi-agent pipeline for backend-interview-guide — separate writer/reviewer roles, parseable Output Contracts, and a hook that catches what self-verification doesn't."
---

This is about the agent harness behind [backend-interview-guide](https://github.com/zeikar/backend-interview-guide), a Korean reference covering ~33 documents across database, cloud, system design, and programming. The whole `.claude/` setup is small — three agent definitions, one orchestrator skill, one hook — and that's the point. It's not impressive because it's elaborate. It's reliable because each piece exists to stop a specific failure mode.

A reasonable starting point would have been one agent that drafts, self-reviews, and patches the index. That works for one document. It collapses by document ten, because the same agent reviewing its own output drifts into self-agreement, the index gets out of sync silently, and there's no consistent shape for the orchestrator to branch on.

So the harness has three agents — `content-writer`, `content-reviewer`, `consistency-checker` — coordinated by an `interview-guide` orchestrator. Three decisions out of that split mattered most.

## A writer shouldn't review its own work

`content-writer` and `content-reviewer` share no conversational state — the saved file is the handoff boundary. The writer drafts and saves; the orchestrator collects the path; the reviewer reads the file fresh with its own context, with no memory of how the draft was produced.

The temptation to merge them is real — one agent could conceivably draft *and* self-check before returning. It doesn't work. The writer is attached to its draft. It just produced 800 lines of Markdown; asking it to find what's wrong is asking it to disagree with itself. In practice it finds nothing, or it finds nits that don't matter, because critiquing structural choices means admitting the structure was off.

The reviewer reads the file *as a file*. It doesn't know what was easy or hard to write. It compares against established documents without internal advocacy. The grading rubric is three tiers — `pass`, `polish`, `rewrite` — with this rule on the top one (the harness uses Korean labels in the source; I'm using English equivalents here):

> **pass** — no technical errors, no missing tradeoffs, deep enough to handle a "why?" follow-up, same style as the existing documents — *all* conditions must hold.
>
> **If the verdict is borderline, grade down.**

Without that last line, the rubric inflates: the strict ALL-clauses of `pass` can be argued away on any single criterion, and an LLM left to pick a verdict on a fence case will tend to pick the kinder one. Pushing tied judgments down — toward `polish` (one revision pass) or `rewrite` (full rewrite) — forces a real revision cycle instead of letting borderline drafts slip through as publish-ready.

The same logic applies to `consistency-checker`. The agent definition has this fence written in (translated):

> Role boundary: fix link and structure issues directly. *Report* missing content, do not write it — that's content-writer's territory. If consistency-checker generates content itself, it bypasses content-writer's style discovery, AGENTS.md compliance, and interview-fit checks, and unreviewed content with no quality guarantee gets merged in.

That's not documentation. That's a fence. Without it the consistency checker — which is a competent agent — starts patching missing files because they look like a structure problem. They aren't. They're a content problem. Fixing them in the wrong agent skips the writer's style discovery and the reviewer's grading, and the harness silently grows documents that nobody graded.

The scary failure mode of multi-agent setups isn't agents disagreeing. It's agents helpfully crossing role boundaries to "be efficient" — and producing output that no one's checked.

## Output Contract: the ABI between agents

The orchestrator branches on the reviewer's verdict:

```
IF overall == "rewrite":                              writer rewrites (max 2 retries)
ELIF overall == "polish" AND critical_count > 0:      writer applies a single patch (no second review)
ELIF overall == "polish":                             publish; report Enhancement notes only
ELIF overall == "pass":                               publish
```

The single-patch case skips re-review on purpose: critical items in the reviewer's contract are concrete enough to apply mechanically (specific section to add, fact to correct), and the SubagentStop hook re-runs the link checker on save anyway, so structural integrity is still guaranteed without paying for another reviewer pass.

That branch only works if the orchestrator can reliably extract `overall` and `critical_count` from a free-form review. Telling an agent to "include the grade clearly" isn't enough — Claude formats it differently every run, sometimes inside a list, sometimes as a section header, sometimes as a sentence.

So every agent has an Output Contract. The reviewer's contract embeds a machine-parseable block in the otherwise human-readable Markdown:

```md
<!-- REVIEW_SUMMARY
overall: pass|polish|rewrite
accuracy: pass|polish|rewrite
interview_fit: pass|polish|rewrite
style: pass|polish|rewrite
critical_count: N
-->
```

The reviewer fills it in alongside the prose. The orchestrator parses it. The reader skimming `_workspace/{topic}/02_review.md` doesn't see it cluttering the page — HTML comments don't render. Same idea in the writer's `Writer Output` block (`work type`, `target file`, `line count`, `main sections`) and `consistency-checker`'s `<!-- CONSISTENCY_SUMMARY -->`.

This is the boring answer to "how do agents talk to each other": you give them a machine-parseable side channel and you make filling it in part of the agent's spec. Not an afterthought, not a postprocess regex over prose. Specified.

## Hooks catch the lies

Every agent ships with a Self-Verification checklist. The writer's has nine items: front matter present, anchor links match real headings, terminology consistent, README updated, etc. The agent ticks them off before submitting.

The checklist isn't enough.

Agents will report "checked, all valid" while shipping a document with a broken anchor. Not maliciously — they pattern-match the right output and skip the actual verification step, and from their perspective they've genuinely confirmed something. The fix is to not trust the report.

`.claude/settings.json` configures a hook that runs after writer and checker stops:

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

When either of those agents finishes, Claude Code runs the link checker. Exit code 2 hard-fails the agent. The "I verified the links" claim is now policed by a script that *actually* verified them. The reviewer has no matcher because the reviewer doesn't write — it has nothing for the script to validate.

This is the cheapest reliability win in the whole harness. The hook is fifteen seconds of Python; the bug it prevents is a doc that publishes with a 404.

## Takeaways

1. **Separate roles by what they're attached to, not by capability.** The writer isn't dumber than the reviewer. It just owns its draft.
2. **If the orchestrator branches on it, parse it.** Free-form output for humans is fine. Free-form output for control flow isn't. Embed a summary block, and make filling it in part of the agent's spec.
3. **Self-verification is a comment. A hook is a contract.** A nine-item checklist still ships broken anchors. A fifteen-second script doesn't.
4. **Save the workspace.** `_workspace/{topic}/` made this post possible. Without it, the only record of how a doc was made would be the doc itself, and that's not enough to debug or to write about later.

The harness is small. Three agents, one orchestrator skill, one hook. The size isn't the point. The point is that each piece pays for its complexity by closing a specific failure mode — and the rest of the system stays out of the way.

---

*Code: [.claude/](https://github.com/zeikar/backend-interview-guide/tree/main/.claude). Project: [backend-interview-guide](https://github.com/zeikar/backend-interview-guide).*
