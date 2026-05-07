---
title: "Why Google Search Console can't fetch your github.io sitemap"
subtitle: "Why every diagnostic on the artifact came back green, why the public theories don't quite agree on the cause, and the custom domain that finally fixed it."
date: 2026-05-07
lang: en
translations:
  ko: /blog/ko/why-gsc-cant-fetch-github-io-sitemap/
description: "Google Search Console kept returning 'Couldn't fetch' on a github.io sitemap that passed every diagnostic — XML schema, Content-Type, Googlebot User-Agent fetch, scope rules, robots.txt all green. The fix had nothing to do with the XML: a custom domain."
---

This is a story about an XML file that wasn't broken. Specifically, why Google Search Console kept saying `Couldn't fetch` on my `sitemap.xml`, why every diagnostic I ran came back green, and why the answer turned out to have nothing to do with the XML.

## The setup

`zeikar.github.io` was a Jekyll site on GitHub Pages. The root `sitemap.xml` was a sitemap *index* — three sub-sitemaps under the same hostname:

```xml
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://zeikar.github.io/sitemap-main.xml</loc></sitemap>
  <sitemap><loc>https://zeikar.github.io/backend-interview-guide/sitemap.xml</loc></sitemap>
  <sitemap><loc>https://zeikar.github.io/charivo/sitemap.xml</loc></sitemap>
</sitemapindex>
```

The main one covers blog posts and project pages. The other two come from sub-projects published as their own GitHub Pages sites under the same hostname.

Submit `https://zeikar.github.io/sitemap.xml` to Google Search Console; GSC reads the index, fetches each sub-sitemap, and queues the URLs for indexing. That was the plan.

What GSC actually did was sit at `Couldn't fetch` for days. Resubmitting didn't help. Waiting didn't help.

## Five green checks

### XML validation

First suspect: the served XML itself. `xmllint` against what GitHub Pages actually returns:

```bash
$ curl -sS https://zeikar.github.io/sitemap.xml | xmllint --noout -; echo $?
0
```

And it validates against the official sitemap.org schema:

```bash
$ curl -sS https://zeikar.github.io/sitemap.xml | xmllint --schema siteindex.xsd --noout -
- validates
```

All three sub-sitemaps validate too, against the corresponding `sitemap.xsd`. Green.

### HTTP & Content-Type

Maybe GitHub Pages serves it with the wrong content type. `curl -I`:

```
$ curl -sI https://zeikar.github.io/sitemap.xml | head -3
HTTP/2 200
server: GitHub.com
content-type: application/xml
```

`200 OK`, `application/xml`. The bytes start with `<?xml` — no BOM, UTF-8 clean. Green.

### Googlebot User-Agent

Maybe Google's bot sees something different from my browser. Diffing the default-UA fetch against a Googlebot-UA fetch:

```bash
$ diff <(curl -sS https://zeikar.github.io/sitemap.xml) \
       <(curl -sSA "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
              https://zeikar.github.io/sitemap.xml)
```

(empty diff). Identical bytes. Green.

### Sitemap index scope rules

The [sitemap index spec](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps) requires that referenced sub-sitemaps live at the same path or deeper than the index, and on the same host. My index is at `/sitemap.xml` — root scope, so anything on the host qualifies. The three sub-sitemaps are all on `zeikar.github.io`, two of them in deeper paths (`/backend-interview-guide/`, `/charivo/`). Green.

### robots.txt

A robots.txt block could shut everything down. Mine has the opposite:

```
User-agent: *
Allow: /

Sitemap: https://zeikar.github.io/sitemap.xml
```

Allow `/`, declare the sitemap explicitly. Green.

---

So: every diagnostic on the artifact came back clean. The XML was fine. The HTTP was fine. The bot could reach it. The path scope was legal. robots.txt was permissive. And GSC still said `Couldn't fetch`.

## The pivot

Searching for the exact error string lands on a pattern that's been documented across years of public reports: GSC frequently fails to fetch sitemaps from `*.github.io` subdomains, even when those same sitemaps work fine for other indexers like Bing. The same XML on a custom domain gets fetched instantly. ([Google Search Central thread](https://support.google.com/webmasters/thread/352368538), [GitHub community discussion](https://github.com/orgs/community/discussions/149884), [Chirpy theme issue #2658](https://github.com/cotes2020/jekyll-theme-chirpy/issues/2658), [a dev.to walkthrough](https://dev.to/stankukucka/google-search-console-cant-fetch-sitemap-on-github-pages-31kn).)

There's no official explanation, and the public threads run on competing community theories. One framing comes from a contributor in the Chirpy thread: that GSC may behave differently depending on whether you've registered the site as a *URL prefix property* or a *Domain property* — and on `.github.io` you can only register a URL prefix property, since the apex belongs to GitHub. They report moving to a custom domain (verifying it as a Domain property via DNS), keeping the GitHub Pages backend unchanged, and the sitemap submitting immediately. Worth noting: Google's [Search Console API](https://developers.google.com/webmaster-tools/v1/sitemaps/submit) and [property documentation](https://support.google.com/webmasters/answer/34592) both list URL-prefix properties as valid sitemap-submission targets, so this isn't a documented requirement — only an observed correlation in the threads. A different theory in the same threads is that GitHub Pages rate-limits Google's automation IP ranges, surfacing as `URL_FETCH_STATUS_MISC_ERROR` inside Google's fetcher. I can't verify either from outside both systems. What's clear is the empirical pattern: same artifact, different host, completely different GSC behavior.

## The fix

So I bought `zeikar.dev` and set up the standard GitHub Pages custom domain: `A`/`AAAA` records on the apex pointing at GitHub's IPs, a `CNAME` file in the repo, and `url: "https://zeikar.dev"` in `_config.yml`. Resubmitted the sitemap to GSC.

GSC fetched it on the first try.

The XML structure was unchanged. The Jekyll build and sub-sitemap layout were unchanged. The HTTP headers were unchanged. The only thing that moved was the hostname inside every URL — `<loc>` values and the `Sitemap:` line in `robots.txt` flipped from `zeikar.github.io` to `zeikar.dev`, but nothing else.

## What I should have tried first

When every diagnostic on the artifact comes back clean, the bug is upstream of the artifact. The cheapest debugging step in that situation is the one that swaps the substrate — not the one that pokes the artifact harder.

A few hours of XML and HTTP-header diagnostics, when 30 seconds of "let me try a different hostname" would have shown me the answer. Different shape from the [getAuthToken](/blog/from-getauthtoken-to-launchwebauthflow/) and [CHIPS](/blog/from-chrome-cookies-to-chips/) posts, but the same family of mistake — I was tuning the wrong thing.
