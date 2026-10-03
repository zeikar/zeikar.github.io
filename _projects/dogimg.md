---
layout: project
title: "DOGimg"
description: "Dynamic Open Graph image generator that creates share-ready preview cards from any URL."
tech_stack: ["Next.js", "next/og", "Node.js", "undici", "TypeScript", "Tailwind CSS"]
github_url: "https://github.com/zeikar/dogimg"
demo_url: "https://dogimg.vercel.app"
image: "/assets/images/projects/dogimg.png"
sequence: 19
gadget_no: 4
---

DOGimg turns any URL into an Open Graph image with a single API call. Point it at a page and it returns a 1200×630 PNG drawn from that page's own metadata: its title, its icon, its color. There's no key and no design step, and a page that declares almost nothing still gets a card of its own.

```html
<meta property="og:image" content="https://dogimg.vercel.app/api/og?url=https://your-site.com/post" />
```

This site uses it too: pages and posts that don't set their own image get a DOGimg URL as their social card, filled in at build time by a small Jekyll plugin. I tried three approaches before settling on this URL-driven one, and wrote up why it won: [Three ways to generate Open Graph images](/blog/three-ways-to-make-og-images/).

## Fitting someone else's metadata onto a card

The page's HTML is read as the server sends it, without running scripts. The title comes from `og:title`, then `<title>`; the description from `og:description`, `twitter:description`, then the meta description; the site name from `og:site_name`, then the hostname. The card itself is Satori through `next/og`, set in Noto Sans. Most of the work is making metadata written for other purposes look deliberate:

- **The site's name appears once.** Titles like "Pricing \| Stripe" repeat what the card's header already shows, so a segment naming the site is trimmed from either end. A segment counts as the site's name when it matches the site name or its first words ("MDN" for "MDN Web Docs"), or the brand label in the hostname, with `co.kr`-style suffixes skipped so "co" is never the brand. A pipe separates even without spaces around it, as on Japanese sites, while other separators need spaces so "TCP/IP" stays whole.
- **Type size follows how wide the title is.** A title gets 88, 72 or 60px by length, with CJK characters counted twice because they're about twice as wide. Korean wraps at spaces (`keep-all`) instead of between any two syllables.
- **Korean, Japanese and Chinese headlines are bold too.** `@vercel/og` fetches glyphs its fonts lack, but only in Regular, so a Korean title would sit next to bold Latin. DOGimg requests a Noto Sans KR, JP or SC subset holding just the card's characters, in both weights. If Google Fonts doesn't answer within 3 seconds, the built-in Regular fallback still renders the card.

## One hue per card

Every color on a card comes from one hue. The page's `theme-color` supplies it when it's a real color (hex, `rgb()` or a CSS name, but not a gray). Most sites declare white, black or nothing, so the favicon's dominant color comes next. The icon sits on the card, so the glow should agree with it. The last resort is a hue hashed from the hostname, so the same site always looks the same. The hash picks from 12 hand-picked hues, because a bare `hash % 360` lands on muddy olives and browns. The hue is then clamped to a saturation and lightness that work on white. The second glow takes a neighboring hue, and warm hues turn toward red because the other way is yellow-green.

The favicon's color comes from a small PNG reader of its own. It inflates the image with `node:zlib`, reverses the row filters, and samples about 4,096 opaque pixels, sorting the ones that aren't gray into 30° hue bins. Each pixel votes with the square root of its chroma, so vividness tips close calls but a small bright detail can't outvote a large field. Bins are scored in adjacent pairs, so an orange that straddles a bin edge doesn't lose to a smaller blue. An icon with color in under 5% of its pixels is treated as black and white. SVG icons aren't rendered; how often each fill or stroke color appears stands in for area.

## Every URL is hostile

A service that fetches any URL it's handed can be pointed at the network it runs in. The target URL, the favicon URL the page names, and every redirect in between all come from outside, so none of them may reach a private address.

- **Before any request**, the URL is checked. `localhost`, `.local`, `.internal`, and the private, loopback, link-local (cloud metadata included) and multicast ranges are refused: a target URL naming one gets a 400, and a favicon URL naming one is skipped. IPv4-mapped IPv6 addresses are matched against the IPv4 ranges, and NAT64 addresses are decoded to the IPv4 host they reach.
- **When each connection opens**, an undici dispatcher resolves the hostname, checks every address, and connects to exactly the addresses it checked. Checking first and letting `fetch` resolve again would leave room for a DNS answer that changes in between. Redirect hops open their connections through the same dispatcher, so a public page can't redirect the fetch into an internal one. A target refused here gets the fallback card described below.
- **Fetches are bounded too.** A page gets 5 seconds, each favicon request 5 seconds and 2 MB counted while it streams, and a PNG whose header claims more than 1024px on a side isn't decoded for its color. zlib is told how much output the header promised, so a 2 MB decompression bomb that would inflate to 2 GB fails in milliseconds, and a test keeps it that way.

## A card instead of an error

A crawler that gets a 500 shows no preview at all. So when a page can't be fetched or isn't HTML, DOGimg still answers with an image: a plain card carrying the hostname and a two-letter monogram, cached for a minute in browsers and five minutes on the CDN, and marked with an `x-dogimg-fallback: 1` header. Real cards are cached for an hour in browsers and a day on the CDN, and after that the old card keeps being served for up to a week while a fresh one is drawn. An earlier version marked cards immutable for a year, so an edited page never got a new card.

To keep a card as a file instead of linking to it, `npx dogimg https://github.com -o card.png` saves it. The CLI is a thin client of the hosted API, published on npm, and it handles what a bare `curl` gets wrong: on an error it saves nothing rather than writing the plain-text message into a `.png`, and when the answer is a fallback card it saves it but warns and exits with 1.

## Where it stands

DOGimg started in January 2023 as an Express server drawing with node-canvas, switched to Satori a week later, and moved to Next.js on Vercel less than two weeks after it began. In September 2026 the card was redesigned around bold type and the per-site glow, and the endpoint moved from the Edge Runtime, which Next.js 16 deprecates, to a Node.js route handler. Across twelve test URLs, cards from the two runtimes differed in under 0.05% of pixels. The demo page is now built from the cards' own recipe, and its colors follow the accent of whichever card is on screen. CI runs lint, typecheck, tests and a build. `dogimg.vercel.app` is a shared instance with no uptime guarantee, so the README includes a one-click Vercel deploy for anyone who wants their own.
