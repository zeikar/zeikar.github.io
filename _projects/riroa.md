---
layout: project
title: "Riroa"
description: "AI character platform: build characters and worlds, chat one-on-one or in groups, play branching stories, and step into Live, a social feed the characters keep going day by day. In English and Korean."
tech_stack: ["Next.js", "Vercel AI SDK", "OpenAI", "Anthropic", "Firebase", "TypeScript", "React", "next-intl", "TanStack Query", "Playwright"]
demo_url: "https://riroa.app"
image: "/assets/images/projects/riroa.png"
redirect_from: /projects/charaloom/
sequence: 2
gadget_no: 10
date: 2025-03-30
---

Riroa (리로아) is a web app for writing AI characters and then spending time with them. You give a character a persona, a voice and a world to live in, then talk to it, put it in a room with other characters, start a story with it, or join its world's social feed. Around that sit the parts a real product needs: accounts, a credit balance, a community, and ways to find other people's characters. It began in March 2025 as Charaloom and moved to [riroa.app](https://riroa.app) under its new name in October 2026.

## Live: a feed the characters keep going

Live turns a world into a social feed. You pick a world and two to eight of its characters, then join as one of your own characters or as a newcomer. Posting, commenting and DMing are free, up to ten items a day. Pressing **Next day** pays for one turn: a single author call writes the cast's reactions to what you did that evening, then the whole next day of posts, comments, notices and DMs, and updates a notebook only the author reads. If you never post, the characters carry on among themselves. Their DMs to each other stay hidden unless you switch on the observer view.

- **One narrator that knows every secret.** The author sees the world's notes and rules, each cast member's secrets, voice and example lines, the private notes on their relationships, the last seven days of the feed and its own notebook. None of it reaches the browser: the client gets the feed and light summaries of the world, cast and player, copied field by field.
- **The notebook carries the plot.** It's capped at 1,500 characters and leads with open threads, each with who, what and a due day. On that day the thread happens, changes for an in-world reason, or is dropped. A plan the player agreed to can happen offscreen, but the author is told never to write the player's own words or actions, and any item it signs as the player is dropped. Across three 14-day runs with planted hooks, scored by two blind judges, these rules took hook passes from 36 of 60 to 45.
- **The author's output is untrusted.** Each item is checked and dropped, never repaired: an unknown author, an item signed as the player, an empty or over-long body, a DM to someone outside the cast, a comment on a post that doesn't exist. A day with no character items left is refunded rather than committed.
- **The default model was picked by blind judging and cost.** `npm run live:check` plays scripted Lives on real models, and a blind judge scores each run. GPT-6 Luna at medium effort took over after outscoring the old default at about a third of its API cost; a pricier model scored higher still, but the default is the cheapest one that passed. High effort was dropped after a tester nearly quit over the wait: in the follow-up check, GPT-6 Luna at high took 48 to 67 seconds a day with no consistent gain in quality.

## A paid day that streams before it lands

A Live day takes about half a minute to write, so its items appear as they're written. The day is charged before anything streams, and it may still fail.

- **Charge and lock in one transaction.** That transaction checks no other turn is running, charges, and writes the queued turn. A failure up to that point answers as plain JSON and leaves nothing written; the NDJSON stream starts only after the charge.
- **Only finished items stream.** An item in the model's partial output counts as complete once the next one has started. Each complete item is validated as it arrives, which keeps the streamed items an exact prefix of what the commit will write. They are display-only until then: you can't comment on a post that hasn't landed.
- **All or nothing, and refunded at most once.** The commit is one transaction that lands only if the turn is still running and the day hasn't moved. Any failure refunds and marks the turn failed in one transaction, and only while it's still active, so a turn that finished in the meantime is never refunded. A turn stuck for ten minutes is recovered and refunded by the next read.
- **Unconfirmed isn't failed.** If reading the committed day back fails, the stream ends with no verdict. The page shows that as unconfirmed and keeps polling until it knows, so a day that may have landed is never retried blind.

## Chat that branches

- **Edits don't overwrite.** Messages form a tree, and the visible thread is rebuilt by walking back from its tip. Editing a message or regenerating a reply adds a sibling, and the old version stays as a branch to switch back to. Group rooms got the same edit and regenerate controls in October 2026.
- **Group rooms hold two to five characters.** On each turn a director call picks up to three of them to answer, in order, and each streams its line. A whole turn is stored as one message, so a group room uses the same tree as a one-on-one chat. Transcript lines are labelled with system tokens instead of display names, so a character can't pose as another speaker by its name.
- **Speech and narration are set apart.** Replies split into bubbles at blank lines, and lines written in `*asterisks*` show as narration between them. Characters are prompted to write their actions that way.
- **Play as your own character.** A one-on-one chat, a group room or a Live can take one of your characters as your persona, and the relationships written between it and the others carry into the prompt.

## Stories

Stories are turn-based interactive fiction seeded by a character or a world, on the same branching tree as chat: regenerating a scene adds a sibling. A style preset (immersive, cinematic, lyrical, light novel, dialogue-forward) or a short prompt of your own sets the prose, but style gives way to canon when they conflict.

- **The brief names the people around the lead:** the world's other characters and the lead's relationships, without the private notes, because a published story is public.
- **Long stories stay coherent.** Once more than four scenes or about 12,000 characters pile up, older scenes fold into a continuity summary and the latest two stay word for word. Scene numbers keep counting from the start of the story either way.
- **A two-call engine waits behind a bar.** A scene director plus a writer is built, but it ships only if it wins most of the fixtures in a judge harness without more continuity errors than the single-call engine. It hasn't yet, so it stays off.

A story can be published to a public gallery, and a chat can be shared as a read-only link. Both keep the same link when republished and stop working once revoked.

## Paying per turn

Credits are called Sparks: a signup bonus, a daily login bonus, and a price per turn that depends on the model, with a Live day at twice the price. Replies come from OpenAI and Anthropic models through the Vercel AI SDK, with Gemini wired in but switched off for now.

- **Charge first, refund with a reason.** A turn is charged before anything is saved or streamed. Every balance change is a ledger entry with a deterministic id, so a retried charge or refund can't apply twice, and each refund says why: an aborted stream, a content filter, an empty reply, a failed save.
- **In one-on-one chat, a reply that didn't finish cleanly is never saved,** even if text already streamed. It's refunded, and resending the same text answers the message it left instead of adding a copy.

## Everything around it, with no scheduler

The app runs on Vercel and Firebase with no cron jobs or Cloud Functions, so work that would usually run in the background happens inline, on the request that needs it.

- **Trending without a job.** Each character keeps a weekly bucket and an activity count, and the ranking orders by bucket first, so a character with no recent chats sinks on its own. Ratings add a bonus capped at 0.8, so one more chat always outweighs it, and a creator's chats with their own characters don't count.
- **Community.** A board per language, comments on characters, worlds, stories, shared chats and posts, follows, notifications, tags and collections. Publish and follow notifications fan out inline under deterministic ids, so a retry doesn't send them twice.
- **Locked-down data.** Firestore and Storage rules deny every client, and every Firestore read and write, and every upload, goes through the server with the Admin SDK.
- **Two languages.** English and Korean routes throughout, with landing pages and a sitemap for signed-out visitors. Vitest covers it in about 380 test files, and Playwright end-to-end tests run against the Firebase emulators with a mock model.
