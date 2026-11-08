---
layout: project
title: "Riroa"
description: "AI character platform: build characters and worlds, chat one-on-one or in groups, play branching stories, and step into Live, a social feed the characters keep going day by day. In English and Korean."
tagline: "AI Character Chat and Story Platform"
tech_stack: ["Next.js", "Vercel AI SDK", "OpenAI", "Anthropic", "Firebase", "TypeScript", "React", "next-intl", "TanStack Query", "Playwright"]
demo_url: "https://riroa.app"
image: "/assets/images/projects/riroa.png"
redirect_from: /projects/charaloom/
gadget_no: 10
date: 2025-03-30
---

Riroa (리로아) is a web app for writing AI characters and then spending time with them. You give a character a persona, a voice and a world to live in, then talk to it, put it in a room with other characters, start a story with it, or join its world's social feed. Around that sit the parts a real product needs: accounts, a credit balance, a community, and ways to find other people's characters. It began in March 2025 as Charaloom and moved to [riroa.app](https://riroa.app) under its new name in October 2026.

## Live: a feed the characters keep going

Live turns a world into a social feed. You pick a world and two to eight of its characters, then join as one of your own characters, as a newcomer, or not at all and just watch. Posting, commenting and DMing are free, up to ten items a day. Pressing **Next day** pays for one turn, in which a single author call writes the cast's reactions to what you did that evening, then the whole next day of posts, comments, notices and DMs, and updates a notebook only the author reads. If you never post, the characters carry on among themselves.

- **One narrator that knows every secret.** The author sees the world's notes and rules, each cast member's secrets and voice, the private notes on their relationships, the last seven days of the feed and its notebook. None of it reaches the browser, which gets the feed and light summaries copied field by field.
- **The server keeps the memory.** A 1,500-character notebook rewritten every turn drifts: a hurt written down on day 3 had turned into "she was glad" by day 13. So alongside the notebook, the author now outputs what changed this turn, in relationships, promises and open storylines, and the server merges it into ledgers in the commit transaction and shows them back verbatim. The server also does the counting: a promise that comes due is marked "settle today", a storyline open for six days "pay off today", and the prompt lists DMs the player never answered and names the character who has been quiet toward them the longest. With the relationship ledger, the day-3 hurt still shaped the day-13 reply in 3 of 3 runs, up from 1.
- **The author's output is untrusted.** Each item is checked and dropped, never repaired: an unknown author, an item signed as the player, an empty or over-long body, a DM outside the cast, a comment on a post that doesn't exist. Ledger changes get the same treatment, and a relationship change may never say how the player feels. A day with no character items left is refunded rather than committed.
- **Cached where it doesn't change.** A turn's input is about 32k tokens, most of it the world and the character sheets. The prompt is split into a stable part ending in an explicit cache breakpoint and a per-turn part with the ledgers, notebook and feed, so about 26k tokens come from the cache. That cut a turn's API cost by about 60% and the median day from 12.4 to 10.4 seconds.

## Measured before it ships

Reading a few feeds can't tell whether a prompt change helped, so Live has a harness. `npm run live:check` plays a scripted player through a Live on real models, and two blind Claude judges score the feeds. Labels are shuffled and the feeds carry no trace of the version, every verdict cites post ids, and a result counts only when both judges point the same way. The main scenario is 14 days with planted hooks: a lunch date that has to happen, a promise the player breaks, a slight that should still show a week and a half later.

- **A held-out scenario catches overfitting.** After a day of tuning, the main scenario's overall score had gone from about 5 to over 6. A second scenario nothing had been tuned on, built from a world running in production with a rubric written before any run, mostly didn't move. Every change now runs against both, and one that moves only the main scenario counts as fitted to it. The full story is in [the write-up](/blog/the-ledger-did-the-work/).
- **Judge what the player sees.** DMs between two characters don't show on the player's screen, so judging whole feeds overstated one version that asked for more of them: 15 to 25 hidden DMs a run, and the visible feed thinned from about 5.7 items a day to 4.4.
- **Rules don't pile up.** A test caps the length of the author's system prompt, so a new rule has to replace one or justify the growth. Moving a single obligation out of the system prompt into a section heading meant the character left waiting stopped reacting to the broken promise in two of three runs, so it went back.
- **A model has to pass a check before it becomes the default.** The Live default is pinned instead of following chat's. High effort was dropped after a tester nearly quit over the wait: on the model then in use it took 48 to 67 seconds a day, with no consistent gain in quality.

## Charged first, refunded once

Credits are called Sparks: a signup bonus, a daily login bonus, and a price per turn that depends on the model, with a Live day at twice the price. Replies come from OpenAI and Anthropic models through the Vercel AI SDK. Every turn is charged before anything is saved or streamed. Each balance change is a ledger entry with a deterministic id, so a retried charge or refund can't apply twice, and each refund records why. In one-on-one chat, a reply that didn't finish cleanly is never saved, even if text already streamed.

A Live day is the hardest case: it takes from ten seconds to most of a minute to write, depending on the model, so its items stream as they're written, and it can still fail after the charge.

- **Charge and lock in one transaction.** It checks no other turn is running, charges, and queues the turn; the stream starts only after that.
- **Only finished items stream.** An item counts as complete once the next one has started, and each is validated as it arrives, so the streamed items are an exact prefix of what the commit will write.
- **All or nothing.** The commit lands only if the turn is still running and the day hasn't moved. Any failure refunds and marks the turn failed in one transaction, and only while it's still active, so a turn that finished in the meantime is never refunded. A turn stuck for ten minutes is recovered and refunded by the next read.
- **Unconfirmed isn't failed.** If reading the committed day back fails, the page shows the day as unconfirmed and keeps polling, so a day that may have landed is never retried blind.

## Chat and stories on one branching tree

Messages form a tree, and the visible thread is rebuilt by walking back from its tip. Editing a message or regenerating a reply adds a sibling, and the old version stays as a branch to switch back to. Group rooms hold two to eight characters: on each turn a director call picks up to three of them to answer, and the whole turn is stored as one message, so a group room uses the same tree. Transcript lines are labelled with system tokens instead of display names, so a character can't pose as another speaker by its name. A one-on-one chat, a group room or a Live can also take one of your characters as your persona, and the relationships written between it and the others carry into the prompt.

Stories are turn-based interactive fiction seeded by a character or a world, on the same tree: regenerating a scene adds a sibling. A style preset or a short prompt of your own sets the prose, but style gives way to canon when they conflict. Once more than four scenes or about 12,000 characters pile up, older scenes fold into a continuity summary and the latest two stay word for word. A two-call engine, a scene director plus a writer, is built but stays off: it ships only when it beats the single call on most fixtures in a judge harness without more continuity errors, and it hasn't yet. Stories can be published to a public gallery, and chats shared as read-only links.

## Everything around it, with no scheduler

The app runs on Vercel and Firebase with no cron jobs or Cloud Functions, so work that would usually run in the background happens inline, on the request that needs it. Trending is the clearest case: each character keeps a weekly bucket and an activity count, and the ranking orders by bucket first, so a character nobody has played lately sinks on its own. Every generated turn counts, in chat, group rooms, stories and Live. Ratings add a bonus capped at 0.8, so one more turn always outweighs it, and a creator's turns with their own characters don't count.

Firestore and Storage rules deny every client, so every read, write and upload goes through the server. The app has English and Korean routes throughout, with a community board per language. Vitest covers it in about 440 test files, and Playwright end-to-end tests run against the Firebase emulators with a mock model.
