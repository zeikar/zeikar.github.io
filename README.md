# zeikar.github.io

Source for [zeikar.dev](https://zeikar.dev), the Irregular Apparatus Lab: a catalogue of my projects, a blog in English and Korean, and a resume. It's a Jekyll site, built and deployed to GitHub Pages by [a GitHub Actions workflow](.github/workflows/pages.yml) on every push to `main`.

## What's where

```text
.
├── index.html               # Home: hero + project catalogue
├── about.html
├── blog.html                # Post index
├── resume.html              # Resume (English)
├── resume-ko.html           # Resume (Korean)
├── 404.html                 # Served by GitHub Pages for any missing path
├── _projects/               # One Markdown file per project page
├── _posts/                  # English posts
│   └── ko/                  # Korean translations
├── _layouts/  _includes/  _sass/
├── _plugins/og_image.rb     # Fills in a DOGimg social card for pages without an image
├── assets/                  # CSS entry, JS, images
├── sitemap.xml              # Sitemap index
├── sitemap-main.xml         # This site's URLs, generated at build time
├── robots.txt
└── CLAUDE.md                # Conventions for agents (and a good read for humans)
```

## Local development

Requires Ruby and Bundler. No Node toolchain.

```bash
bundle install
bundle exec jekyll serve   # http://127.0.0.1:4000, rebuilds on change
bundle exec jekyll build   # production output in _site/
```

## Adding content

### A project

Add `_projects/<name>.md`:

```md
---
layout: project
title: "My Project"
description: "One sentence; it's the home card text and the page summary."
tech_stack: ["TypeScript", "WebGL2"]
github_url: "https://github.com/zeikar/my-project"
demo_url: "https://zeikar.dev/my-project/"
image: "/assets/images/projects/my-project.png"
sequence: 21
gadget_no: 21
date: 2026-10-01
---
```

- `sequence` is the order on the home page. `gadget_no` is the UNIT number, assigned by build order, and never changes.
- `date` is when the project started (its repo's creation date). It becomes the page's `datePublished`; without it, Jekyll stamps the build time on every deploy. Never use today's date: the Pages build runs in UTC and skips documents dated in the future, so a same-day KST date can drop the project from the site without a warning.
- The card shows the first six `tech_stack` entries. Leave out version numbers.
- `demo_url` and `image` are optional. Without an `image`, both the social card and the home card come from DOGimg, rendered live on every visit, so save that render as the PNG instead.
- Keep `image` a PNG, since it's also the social card. Drop a smaller `.webp` with the same name next to it and the project page uses that instead. The home card prefers a 960px-wide `.card.webp` (`cwebp -q 80 -resize 960 0`, only when the PNG is wider than 960px) and falls back to the `.webp`.

The page body has no fixed template. See [CLAUDE.md](CLAUDE.md) for how the pages are written.

### A blog post

English posts go in `_posts/` and publish under `/blog/<slug>/`. Korean posts go in `_posts/ko/` under `/blog/ko/<slug>/`. Link a pair with `translations:` in each post's front matter:

```yaml
translations:
  ko: /blog/ko/some-post/
```

### Sitemaps

`sitemap.xml` is an index. It points to `sitemap-main.xml`, which lists this site's pages, posts and projects, and to the sitemaps of other repos deployed under zeikar.dev (`/charivo/`, `/iki/`, …).

- A project whose `demo_url` is on zeikar.dev joins `sitemap-main.xml` automatically.
- Any other same-site URL goes in `extra_sitemap_urls` in `_config.yml`.
- When a new sub-site goes live under zeikar.dev, add its sitemap to both `sitemap.xml` and `robots.txt`.
