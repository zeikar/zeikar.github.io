---
layout: project
title: "DOGimg"
description: "Dynamic Open Graph image generator that creates share-ready preview cards from any URL."
tech_stack: ["Next.js 16", "TypeScript", "@vercel/og", "Tailwind CSS", "Vercel"]
github_url: "https://github.com/zeikar/dogimg"
demo_url: "https://dogimg.vercel.app"
image: "/assets/images/projects/dogimg.png"
sequence: 6
---

DOGimg turns any URL into a share-ready Open Graph image with a single API call. Point it at a page and it returns a 1200×630 PNG built from that page's own metadata — no manual design step.

## How it works

1. Fetch the target page's HTML
2. Parse its metadata — `og:*`, `twitter:*`, `<title>`, `theme-color`, and the favicon
3. Render a 1200×630 card with `@vercel/og`

That's the whole contract: `GET /api/og?url=<target>` returns an `image/png`. Drop the URL straight into an `og:image` tag and your link previews are done.

```html
<meta property="og:image" content="https://dogimg.vercel.app/api/og?url=https://your-site.com/post" />
```

It isn't just a demo, either — every social card on this site is a live DOGimg call, wired in at build time by a small Jekyll plugin. I tried three approaches before settling on this URL-driven one, and wrote up why it won: [Three ways to generate Open Graph images](/blog/three-ways-to-make-og-images/).
