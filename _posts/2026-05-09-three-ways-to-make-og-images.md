---
title: "Three Ways to Generate Open Graph Images, and the One I Built"
subtitle: "I didn't want to copy a title and theme color the page already serves, so I built a generator that takes nothing but the URL."
date: 2026-05-09
unit: dogimg
last_modified_at: 2026-11-18
lang: en
translations:
  ko: /blog/ko/three-ways-to-make-og-images/
description: "Three ways to make Open Graph images (hand-drawn PNGs, param-driven generators, and dogimg, which takes only the page URL) and what each one costs."
---

Paste this post's link into Slack or X and the preview card that shows up wasn't drawn by me. [dogimg](https://dogimg.vercel.app), a service I built in 2023, reads this page and draws it. There are roughly three ways to make Open Graph images, and dogimg takes the third. Here they are in order, with what each one still leaves for a person to do.

## Hand-drawn PNGs

The simplest way is to draw a 1200×630 PNG in something like Figma and set it as each page's `og:image`. For a handful of pages, that's enough.

As posts pile up, every one of them adds a drawing, an export, and a file in the repo. Change the site's brand color or favicon and every image already out there keeps the old look.

And most of what goes into an OG image is already on the page: the `<title>`, the description, the theme color, the favicon. They're there for browsers and crawlers to read. Drawing the image by hand means writing the same content twice, once on the page and once in the picture.

## Generators that take the content as parameters

Next come services that draw the image from content you pass as query parameters:

```
https://og-generator.example/api/og?title=My+Post&description=...&theme=teal
```

Vercel's [`vercel/og-image`](https://github.com/vercel/og-image) was the canonical example (the repo is archived now). The image is drawn from a template when it's requested, so there are no PNGs in the repo. A clear step up from drawing by hand.

But the metadata still has to be carried over. For every post, something has to pack the title and description into a query string, whether that's you by hand or a build step that reads front matter and builds the URL. The page already knows its own title; the build step reads it, encodes it again, and the service receives it and draws it. Here the URL is a template the caller has to fill in.

## A generator that takes only the page URL: dogimg

[dogimg](/projects/dogimg/) removes the filling-in too. The page already serves HTML with a `<title>`, a `<meta name="description">`, `og:*` tags, a `theme-color` and a favicon link. Instead of the caller carrying that over, the generator can ask the page directly.

So the API has one parameter:

```
https://dogimg.vercel.app/api/og?url={URL}
```

On each request, dogimg:

1. Fetches the HTML at `{URL}`.
2. Reads the title (`og:title`, or `<title>` without it), the description (`og:description`, `twitter:description`, then `description`), the site name, the `theme-color` and the largest favicon.
3. Draws a 1200×630 PNG with `next/og`. The favicon becomes the icon at the top of the card, and the theme color becomes the glow along its right edge. When there's no theme color, or it's a gray, the favicon's dominant color stands in.

It first drew with `@vercel/og`; today it calls the same renderer bundled in Next.js through `next/og`. On the consumer side, the whole integration is one tag:

```html
<meta property="og:image" content="https://dogimg.vercel.app/api/og?url=https://your-site.com/post" />
```

Edit a post's title and there's no generator to redeploy and no PNG to redraw. The next time dogimg draws the card, it reads the new title.

## This site's Jekyll plugin

On zeikar.dev, [_plugins/og_image.rb](https://github.com/zeikar/zeikar.github.io/blob/main/_plugins/og_image.rb) fills in that URL at build time. On the `post_read` hook, it sets `page.image` to a dogimg URL for every document that doesn't set `image:` in front matter:

```ruby
encoded = CGI.escape(base + item.url)
item.data["image"] = "https://dogimg.vercel.app/api/og?url=#{encoded}"
```

It covers `site.documents` (posts and every collection doc, `_projects/*.md` included) and the `site.pages` with `layout: default`. `jekyll-seo-tag` then emits `og:image` and `twitter:image` from `page.image`, once each.

The first version printed the `og:image` tag from the layout instead. But `jekyll-seo-tag` emits `twitter:card` as `summary` for a page with no image, so next to the layout's `summary_large_image` there were two of them, and a crawler that reads the first one shows a small card instead of the large one. With `page.image` filled in beforehand, `jekyll-seo-tag` emits `summary_large_image` once. Writing a post involves no OG step at all.

## What a URL-only generator costs

The handwork is gone, but the card is now drawn on someone else's server when it's requested, and that has costs.

Cards don't change right away. dogimg caches a card on its CDN for a day, and services like Slack and Facebook keep their own copy of a preview once they've fetched it, so a retitled post's card takes a while to catch up. You also can't see the card before deploying: dogimg refuses private addresses like `localhost`, so there's no card until the page is at a public URL.

When dogimg can't read the page, it sends a plain card with just the hostname. That one is cached for only five minutes, so the next request tries again. The hosted dogimg is a shared instance with no uptime guarantee; the README has a Vercel deploy button for running your own.

Show a card on the page itself, rather than in a link preview, and the render cost lands on your visitors. That happened on this site. Two projects had no `image:`, so the dogimg URL the plugin filled in became their home-page card image, and every visit waited on a live render of about 200KB and 1 to 1.7 seconds each. Those two got their dogimg cards saved as static PNGs in `image:`. Today all 32 projects have their own PNG, the plugin skips them, and only posts and top-level pages use dogimg cards.

*This post first read as if this site had gone through hand-drawn PNGs and a param-driven generator before I built dogimg. In fact dogimg came first, in 2023, and this site has used it since its first post. In November 2026 I corrected that order and added the section on costs.*
