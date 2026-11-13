---
title: "Why Pagefind Can't Find Words Inside Korean Compounds"
subtitle: "I added Pagefind to a static blog, and searching 복잡도 (complexity) didn't find 시간복잡도 (time complexity). Pagefind matches only from the start of a word, and Korean writes compound nouns as one word. Three days later Pagefind was gone, replaced by one JSON file written at build time."
date: 2026-11-14
unit: repozine
lang: en
translations:
  ko: /blog/ko/pagefind-korean-search/
description: "Pagefind matches only word prefixes, so a query can't match inside a Korean compound like 시간복잡도. A reproduction, and the build-time search.json that replaced it: matching anywhere in a word, ranking word starts first, and keeping results stable while a Korean IME composes."
---

[repozine](/projects/repozine/) turns posts written in GitHub Discussions into an Astro blog. Its biggest site is [zeikar.dev/leetcode](https://zeikar.dev/leetcode/), 165 LeetCode solution notes I've written since 2021, almost all in Korean. On September 14 I added search. For a static site the usual answer is Pagefind, so that's what I used: after the build, `pagefind --site dist` reads the output and writes an index, and the browser downloads only the pieces a query needs.

Then I searched 복잡도, "complexity", and got 8 notes. Far more than 8 contain it.

## Pagefind matches from the start of a word

I reproduced it with a three-page site, Pagefind 1.5.2, `lang="ko"`:

| page text | 복잡도 | 시간 | 잡도 |
|---|---|---|---|
| 시간복잡도는 O(n)이다. (time complexity is O(n)) | not found | found | not found |
| 복잡도는 O(n log n)이다. (complexity is O(n log n)) | found | | not found |
| 공간 복잡도를 줄였다. (cut the space complexity) | found | | not found |

복잡도 finds 복잡도는 and 복잡도를, the word followed by a particle, but not 시간복잡도는. 잡도, the tail of the word, finds nothing at all. Pagefind splits text into words at spaces and matches a query only against the start of a word. In English that's enough: "complex" finds "complexity". Korean attaches particles to the end of a word, which prefix matching handles. But it also writes compound nouns without a space: 시간 (time) plus 복잡도 (complexity) is 시간복잡도, and the second noun can't be found.

The docs say Pagefind segments words for languages written without spaces, but only Chinese, Japanese and Thai. Korean isn't on that list, so it's split on spaces like English, and the indexer only prints a note that it doesn't support stemming for `ko`. I didn't find any option for matching inside a word.

On the real notes the gap is large. 35 of the 165 contain 복잡도, and only 8 of those have it at the start of a word. The rest wrote 시간복잡도 or 공간복잡도 (space complexity).

## Search that matches inside words

Pagefind's index is built around word starts, and I found no setting that changes that. So on September 17 I removed Pagefind. The build now writes every post's title and text to one `search.json`, and the browser downloads it and searches it directly. For 165 posts it's 221KB, 70KB gzipped, which is fine to fetch once when the search page opens. A site with far more text would want an index again.

The rule is simple. The query is split on spaces, and a post matches when it contains every word somewhere, in any case. Matching inside words means 복잡도 finds 시간복잡도는, and 해시 맵 (hash map, typed as two words) finds 해시맵 (written as one). Dropping the Pagefind step also means search now works under `npm run dev`.

## Keeping inside-word matches below word starts

Matching anywhere brings its own problem. Searching 합을 ("the sum", with its particle) matches 두 수의 합을 구한다, "find the sum of two numbers", and also 조합을 센다, "count the combinations", because 조합 (combination) happens to contain 합. Both can be in the results, but the first should come first.

So a hit scores by where it lands. A hit at the start of a word counts 1, a hit inside one 0.25. A hit in the title outweighs any body text: 20 at a word start, 10 inside. In the body, repeats of the same word push its score toward 1 but never past it.

## Keeping results while the IME composes

Korean search has one more problem. While the IME is still composing the last syllable, the search box holds a half-built character. Typing 배열 (array) passes through ㅂ, 배, 뱅, 배여 and then 배열. Searching on every keystroke made the results vanish at 뱅 or 배여 and come back a moment later.

So the last syllable, while it's being composed, is expanded into every syllable it can still become. 뱅 might stay 뱅, or, when a vowel follows, its final ㅇ moves on to start the next syllable, so it also matches 배 followed by any syllable starting with ㅇ. Finals and vowels that can still grow into compound ones are included too. Matching that widely has its own cost: typing 시간 passes through 식, which matches every post containing 식. So posts that match the query as typed come first, and posts that only match what the last syllable might become come after them.

Last, in Chrome, clicking a result while a syllable was still composing sometimes went nowhere. Pressing the link took focus from the search box, which ended the composition, and Chrome then scrolled the box back into view, so the link had moved before the click completed. Calling `preventDefault()` in the result link's `mousedown` kept focus in the search box and fixed it.
