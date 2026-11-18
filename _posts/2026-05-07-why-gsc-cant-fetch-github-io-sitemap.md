---
title: "Why Google Search Console Can't Fetch Your github.io Sitemap"
subtitle: "Every check I ran on the sitemap file passed, and GSC only fetched it after the site moved to a custom domain."
date: 2026-05-07
last_modified_at: 2026-11-18
lang: en
translations:
  ko: /blog/ko/why-gsc-cant-fetch-github-io-sitemap/
description: "Search Console said 'Couldn't fetch' for a github.io sitemap that passed every check: schema, Content-Type, Googlebot, robots.txt. A custom domain fixed it."
---

`zeikar.github.io` was a Jekyll site on GitHub Pages. The root `sitemap.xml` was a sitemap *index* pointing at three sub-sitemaps on the same host:

```xml
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://zeikar.github.io/sitemap-main.xml</loc></sitemap>
  <sitemap><loc>https://zeikar.github.io/backend-interview-guide/sitemap.xml</loc></sitemap>
  <sitemap><loc>https://zeikar.github.io/charivo/sitemap.xml</loc></sitemap>
</sitemapindex>
```

The main one covers the site's pages, blog posts and project pages. The other two belong to projects published as their own GitHub Pages sites under the same host.

Submit the index to Google Search Console, and GSC fetches each sub-sitemap and queues the URLs for indexing. That was the plan. Instead, GSC sat at `Couldn't fetch` for days. Resubmitting didn't help, and neither did waiting.

## Five green checks

### XML validation

First suspect: the served XML itself. `xmllint` on the bytes GitHub Pages actually returns says it's well-formed:

```bash
$ curl -sS https://zeikar.github.io/sitemap.xml | xmllint --noout -; echo $?
0
```

It also validates against the official sitemaps.org schema:

```bash
$ curl -sS https://zeikar.github.io/sitemap.xml | xmllint --schema siteindex.xsd --noout -
- validates
```

All three sub-sitemaps validate against `sitemap.xsd` too.

### HTTP response and Content-Type

Maybe GitHub Pages served it with the wrong content type:

```
$ curl -sI https://zeikar.github.io/sitemap.xml | head -3
HTTP/2 200
server: GitHub.com
content-type: application/xml
```

`200`, `application/xml`. The bytes start with `<?xml`, UTF-8 with no BOM.

### Googlebot User-Agent

Maybe Googlebot gets a different response, so I diffed a default-UA fetch against a Googlebot-UA fetch:

```bash
$ diff <(curl -sS https://zeikar.github.io/sitemap.xml) \
       <(curl -sSA "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
              https://zeikar.github.io/sitemap.xml)
```

Empty diff. Identical bytes.

### Sitemap index scope rules

Google's [sitemap index docs](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps) say the sitemaps an index references must be on the same site as the index, in the same directory or deeper. My index is at `/sitemap.xml`, so its scope is the root, and all three sub-sitemaps are on `zeikar.github.io`, two of them in deeper paths (`/backend-interview-guide/`, `/charivo/`).

### robots.txt

A robots.txt block would sink everything else. Mine did the opposite: it allowed everything and declared the sitemap.

```
User-agent: *
Allow: /

Sitemap: https://zeikar.github.io/sitemap.xml
```

Near the end I listed the three sub-sitemaps there as well, each on its own `Sitemap:` line.

All five passed. GSC still said `Couldn't fetch`.

## A github.io-only problem

Searching the exact error string turns up the same report from 2021 to this year: GSC can't fetch a `*.github.io` sitemap, and several people say it went through as soon as they moved to a custom domain. One reports that Bing Webmaster Tools took the same file. ([Google Search Central thread](https://support.google.com/webmasters/thread/352368538), [GitHub community discussion](https://github.com/orgs/community/discussions/149884), [Chirpy theme issue #2658](https://github.com/cotes2020/jekyll-theme-chirpy/issues/2658), [a dev.to walkthrough](https://dev.to/stankukucka/google-search-console-cant-fetch-sitemap-on-github-pages-31kn))

There's no official explanation, and the guesses about the cause differ. One comment in the Chirpy issue suggests Google won't take a sitemap for a domain you don't own. That commenter bought a domain, verified it as a Domain property over DNS, and the sitemap submitted right away with GitHub Pages still serving the site. A `.github.io` site can only be a URL prefix property, since the apex belongs to GitHub and you can't verify it over DNS. But Google's [Search Console API docs](https://developers.google.com/webmaster-tools/v1/sitemaps/submit) and [property docs](https://support.google.com/webmasters/answer/34592) both allow sitemap submission for URL prefix properties, so needing a Domain property isn't a documented requirement, only a correlation seen in the threads.

In the GitHub community discussion, one comment says GitHub's servers block automated access, Googlebot included, and that it surfaces as `URL_FETCH_STATUS_MISC_ERROR`. My Googlebot check only changed the User-Agent, so it couldn't catch blocking by IP. On the other side, some commenters say owning a domain didn't fix it, or that moving to Cloudflare Pages didn't either. I can't see inside GitHub or Google, so there's no way for me to confirm any of it. What was clear is that I'd run out of checks to run on the file, and the one variable left was outside it: the host.

## The custom domain

So I bought `zeikar.dev` and set it up the standard GitHub Pages way: `A`/`AAAA` records on the apex pointing at GitHub's IPs, a `CNAME` file at the repo root, and `url` in `_config.yml` set to `https://zeikar.dev`. Then I resubmitted the sitemap.

GSC fetched it on the first try.

The XML structure, the Jekyll build and sub-sitemap layout, and the HTTP headers were all unchanged. Only the hostname inside the URLs moved: the `<loc>` values and the four `Sitemap:` lines in robots.txt went from `zeikar.github.io` to `zeikar.dev`.
