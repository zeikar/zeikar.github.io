# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal portfolio + project archive at zeikar.dev. Jekyll static site deployed to GitHub Pages from `main` via [.github/workflows/pages.yml](.github/workflows/pages.yml). Custom domain via [CNAME](CNAME). No JS/Node toolchain. No test suite.

## Commands

- `bundle install` — install gems (Ruby + Bundler required)
- `bundle exec jekyll serve` — dev server at http://127.0.0.1:4000, auto-rebuild
- `bundle exec jekyll build` — production build to `_site/`

## Non-obvious architecture

### OG images come from a plugin, not from front matter

[_plugins/og_image.rb](_plugins/og_image.rb) runs at `post_read` and auto-fills `page.image` with `https://dogimg.vercel.app/api/og?url=<page-url>` whenever a doc lacks an explicit `image:`. Coverage: **`site.documents`** (posts + every collection doc, including `_projects/*.md`) plus **top-level pages with `layout: default`**. `jekyll-seo-tag` then emits `og:image` / `twitter:image` from `page.image`. Don't add a layout-level OG-image fallback in [_layouts/default.html](_layouts/default.html) — it would be dead code under this plugin.

### SEO signals live in the layout, not in _config.yml

[_layouts/default.html](_layouts/default.html) injects:

- WebSite JSON-LD with `alternateName` — homepage only (gated on `page.url == '/'`)
- Person JSON-LD with `sameAs` — `/about/` only
- `<link rel="alternate" hreflang>` (en / ko / x-default) — for any page with `translations:` in front matter

When debugging Google/social cards, check the layout AND [_plugins/og_image.rb](_plugins/og_image.rb) before `_config.yml`.

### Bilingual posts and resume

English posts live in `_posts/`, Korean in `_posts/ko/`. Permalinks differ by language (`/blog/:title/` vs `/blog/ko/:title/`), set via `defaults` in [_config.yml](_config.yml) — that block is **type-scoped to `posts`** so it doesn't rewrite `/about/`, `/resume/`, etc. Cross-link translations via:

```yaml
translations:
  ko: /blog/ko/some-post/
```

Both [_layouts/default.html](_layouts/default.html) (hreflang) and [_layouts/post.html](_layouts/post.html) (translation link button) read this field. The resume page pair (`/resume/` + `/resume-ko/`) also uses it.

### Sitemap is hand-rolled

The site does **not** use `jekyll-sitemap` despite the Gemfile listing — it's not in the `plugins:` array in [_config.yml](_config.yml). [sitemap.xml](sitemap.xml) is a manual sitemap *index* pointing at:

- [sitemap-main.xml](sitemap-main.xml) — pages, posts, projects, plus URLs from `extra_sitemap_urls:` in `_config.yml`
- `/backend-interview-guide/sitemap.xml` and `/charivo/sitemap.xml` — *separate* Pages sites in other repos, deployed at sub-paths of zeikar.dev

If a new sub-Pages site lands under zeikar.dev, add its sitemap to both [sitemap.xml](sitemap.xml) and [robots.txt](robots.txt).

### Project ordering

`_projects/*.md` are sorted by integer `sequence:` in front matter on the home page and in [sitemap-main.xml](sitemap-main.xml). New project entries need a `sequence: N`. If `demo_url` is on `zeikar.dev`, it auto-joins the sitemap.

### Manifest needs empty Jekyll front matter

[assets/images/site.webmanifest](assets/images/site.webmanifest) starts with `---` / `---` so Jekyll runs Liquid on it. Without that, `{{ site.title }}` ships as a literal string. The IDE will flag the file as invalid JSON — that's expected; Jekyll strips the front matter at build time.

## Content tone

Home and About copy intentionally lean playful and self-deprecating to match the `(>_<)` favicon. Resume pages stay professional as deliberate contrast. Don't carry resume tone into home/about, or vice versa.

In `.html` page bodies, HTML-escape angle brackets in copy: `(&gt;_&lt;)`, not `(>_<)`. Kramdown only processes `.md`, but the HTML parser can still misread a bare `<`.
