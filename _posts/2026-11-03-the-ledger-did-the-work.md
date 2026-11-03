---
title: "More Rules Made It Worse. A Ledger Fixed It."
subtitle: "Riroa Live has one LLM write a five-character social feed, one day at a time. Characters forgot promises, let grudges fade, and kept repeating the same invitation. Server-held state fixed that, prompt rules didn't, and most of the score I gained on one scenario turned out to be fitted to it."
date: 2026-11-03
unit: riroa
lang: en
translations:
  ko: /blog/ko/the-ledger-did-the-work/
description: "How I improved Riroa Live's author prompt: 14-day simulations scored with LLM-as-a-judge, relationship, promise and storyline ledgers kept on the server, and a held-out scenario to catch overfitting."
---

[Riroa](/projects/riroa/)'s Live mode takes a world and a few of its characters and runs the social network they post on, one day at a time. The player posts, comments and DMs in it. Each time the day turns over, one LLM call writes that evening's reactions and all of the next day's posts. The model is Claude Sonnet 5.5, and the output is a single structured JSON object.

One day at a time, it read fine. Two weeks was the problem. A promise made on day 3 was forgotten by day 10. A character hurt on day 3 was cheerfully warm by day 13, as if nothing had happened. A player who didn't answer got the same invitation for days on end. This post is the record of one day spent fixing that. The short version: what worked was a ledger, and a good part of the first improvement I measured was an illusion.

## Measure first

Reading a few feeds by hand can't tell you whether a change helped, so I started with a simulation.

The scenario is one world, five characters, 14 days. The player, Yuna, is a script instead of a person. On day 3 she makes a lunch date and publicly disagrees with one of the characters; on day 6 she promises to send a journal by day 9, and never does. Some days she does nothing at all.

What has to happen in response went into a checklist of hooks: "the lunch is treated as having happened", "the broken promise is noticed the day after it was due", "the day-3 slight still colours the day-13 reply", and so on. Scoring is LLM-as-a-judge; how that works is at the end.

A new version gets 3 runs. One 14-day run costs about $0.45 in API calls, so measuring a version costs about $1.40.

## One rule blocked another

My first move was the obvious one: add rules to the prompt. A rule against making the same offer to a silent player more than twice cut down the chasing. It also cut down how often anyone noticed the broken promise. The model had read "stop messaging the player" as "don't bring up the missed promise either". So I added another rule: not chasing someone is not the same as ignoring a promise they broke.

That day the system prompt grew 55%. Rules collided, and the fixes for the collisions were more rules.

## The model writes changes; the server remembers

The turn came with relationships. The model now also outputs `relationshipChanges`: only when this turn changes how one character feels about another, it writes the new state and what caused it. The server stores that on the Live document and, from the next turn on, shows it verbatim under "Where relationships stand now" in the part of the prompt that is rebuilt every turn.

The day-3 slight showed up in the day-13 reply in 3 runs out of 3, up from 1. Before, the author's notebook rewrote that feeling a little each day and drifted toward friendly. Now "hides the hurt and keeps her distance" stays word for word until something changes it.

Promises got the same treatment. The model records a promise being made, changed or ended in `promiseChanges`; the server keeps the due day, and when one comes due it marks it:

```
- [p6-1] Yuna → Lise: send the practice journal · due day 9 · settle today
```

The system prompt has one rule about it: anything marked "settle today" is closed this turn as kept, broken or changed. Now all three runs have someone call out the missing journal. Before, only one did; the model had taken the due-day reminder ("send it by tomorrow!") as the settlement, and nobody mentioned it again.

The rest followed the same pattern.

| Problem | What the server counts | What the model sees |
|---|---|---|
| Chasing a silent player | DMs to the player that got no reply | An "unanswered DMs" list |
| After week one, nobody starts anything with the player | Each character's last day speaking to the player | One name under "who reaches out today" |
| The agreed lunch happens off-screen (agreed moments) | Player promises due on the day being written | An "on the feed tomorrow" mark |
| Clues every day, never a payoff (storyline ledger) | When each mystery or conflict opened and last moved | "Pay off today" after 6 days; "nothing has moved for two days" when it stalls |
| Weekdays drift | The weekday the Live was created on | A weekday on every day heading |

Code decides when and how often; the model decides what to write. When the model kept count, it got it wrong. When the server counted and told it, it mostly got it right.

## Suggestions get ignored; obligations get followed

Not every ledger worked on the first try. "Who reaches out today" started as a suggestion in a section heading. The name was shown on five turns and acted on in none. Moved into the system prompt as an obligation, "if someone is named, that character brings the player into something of their own in one of the next day's posts", it took the runs where someone reached out in week two from 0 to 2 or 3 of 3, depending on the judge.

It also went the other way. The prompt had grown, so I moved rules that only concern one piece of data into that data's section heading. When the "settle today" rule moved too, the runs where someone called out the journal dropped back to one. The model still closed the promise as broken, but stopped writing the scene where Lise, who was waiting for it, says so. That rule went back into the system prompt.

Words that explain the data can live next to the data. An obligation to write a scene has to live in the system prompt. The system prompt's length is now capped by a test: to add a rule, remove one, or write next to the test why it has to grow.

## Caching cut the cost

A turn's input is about 33k tokens, and most of it is the world and the character sheets. I split the prompt into a part that's the same every turn (system prompt, world, cast, relationships from the sheets) and a part that changes (ledgers, notebook, feed), and put a cache breakpoint after the first. Most of the input now comes from the cache. Turn cost dropped about 60% and median latency went from 12.4 s to 10.4 s; a turn now costs a little over three cents. Since only a few ledger lines at the end change each turn, the cached prefix stays intact.

## Verbal tics came from the sheets

The judges kept flagging one more thing: characters reduced to their catchphrases. One put ☺ on almost every post; another wrote every post as a patrol log ending in "Over."

I tried the server-counting approach here too. It found any word one character used in more than half their recent posts and the others rarely did, and listed it as off-limits for this turn. Resting ☺ moved that character to 🌤, and resting 🌤 moved her to 🍪. Treating all emoji as one habit didn't move her emoji rate off 83-100%.

The cause was in the character sheet: "every post is a patrol log, and always ends with 'Over.'" When the sheet says every time, a prompt saying "not this turn" isn't going to win. The real fix was changing the sheets' "every", "always" and "often" to "mostly", "tends to" and "sometimes". I rolled back the emoji grouping.

## The score that went up on one scenario

With the last batch on top of the relationship and promise ledgers (the tic list, the "on the feed tomorrow" mark, the storyline ledger), the first scenario's overall score went from 5.0-5.3 to 6.0-6.7. That looked good. Then I wondered whether it was overfitting, and it had every reason to be: one world, one cast, one player script and one set of hooks, all day long. Even the example wording in the rules was copied from failures I'd seen in that scenario.

So I built a scenario nothing had been tuned on. I took another world running in production (a share house in Seoul) and its five characters, and wrote a 12-day script for a new tenant who is far more active than Yuna. The scenario-specific hooks gave way to nine general questions: consistent voices, continuity, consequences of the player's choices, promises, payoffs, characters reaching out, pacing, honesty toward the player, and repetition. The script and the questions were written before I looked at a single run.

| Version (2 runs each) | Judge 1 | Judge 2 |
|---|---|---|
| Up to the relationship and promise ledgers | 5.5, 7.5 | 5, 6 |
| + tic list, agreed moments, storyline ledger | 6, 6.5 | 6, 7 |
| + the rule against inventing player actions | 7, 5 | 7, 6 |

Averaged per judge, every version lands between 5.5 and 6.5, and runs of the same version range from 5 to 7.5. The gap of more than a point from the first scenario mostly didn't come back.

A few things did hold in both. In the first scenario, runs with a clear peak in week two went from 1 of 3 to 2 of 3. In the new one, the version with the storyline ledger got "one day is clearly bigger than the days around it" in all four judge calls, and the version before the ledger in none. The version with one more sentence on top of the same ledger split two and two, though, so with two runs each I wouldn't lean on it. One sentence, telling the model not to treat an unanswered invitation as accepted, took posts that invented something the player never did from 4-6 to 0 in the first scenario, and was the lowest of the three in the new one. Those two were the only changes pointing the same way in both scenarios, so those are the two I counted as real.

Now every change runs against a held-out scenario as well, and a change that only moves one of them counts as fitted to that one. That's also when I learned that a one-point gap between batches of three runs can be noise.

## How the judging worked

The judges are two Claude subagents. A few things were settled up front.

- A judge that knows which feed is new will side with it. Labels are shuffled, and the feed files carry no trace of the version. When the server started adding weekdays, the weekday in a heading alone would have given the new version away, so I first checked that the judges' feeds didn't have them.
- Every verdict cites post ids. A bare score doesn't say why, and a wrong verdict can't be caught.
- There are two judges because their standards differ. One counted a same-day "I'll save us seats" post as the lunch being on screen; the other didn't. I trusted a result only when both pointed the same way.
- Judges are noisy too, and the same feed read twice can score differently. I trusted items I could check against post ids ("on which day was the broken promise noticed", "how many posts claim the player did something she didn't") over the scores themselves.

## What's left

Numbers the characters count themselves are still wrong. A "D-7 to quince syrup day" countdown slips a day; a "days since I moved in" count ends up three days off. Unlike weekdays, these are numbers the characters invent inside the story, so the server can't easily count them. And the score is still 6 to 7 out of 10. Going further would mean chasing differences smaller than the measurement noise, so this is where I stopped.
