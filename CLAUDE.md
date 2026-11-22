# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal portfolio + project archive at zeikar.dev. Jekyll static site deployed to GitHub Pages from `main` via [.github/workflows/pages.yml](.github/workflows/pages.yml). Custom domain via [CNAME](CNAME). No JS/Node toolchain. No test suite.

## Commands

- `bundle install` — install gems (Ruby + Bundler required)
- `bundle exec jekyll serve` — dev server at http://127.0.0.1:4000, auto-rebuild
- `bundle exec jekyll build` — production build to `_site/`

A change asked for here ships: commit to `main`, push, and confirm the Pages deploy. Ask first only for a proposal or mockup the user is still weighing, or for anything outside this repo.

## Non-obvious architecture

### OG images come from a plugin, not from front matter

[_plugins/og_image.rb](_plugins/og_image.rb) runs at `post_read` and auto-fills `page.image` with `https://dogimg.vercel.app/api/og?url=<page-url>` whenever a doc lacks an explicit `image:`. Coverage: **`site.documents`** (posts + every collection doc, including `_projects/*.md`) plus **top-level pages with `layout: default`**. `jekyll-seo-tag` then emits `og:image` / `twitter:image` from `page.image`. Don't add a layout-level OG-image fallback in [_layouts/default.html](_layouts/default.html) — it would be dead code under this plugin.

A project's explicit `image:` is therefore also its `og:image`, so keep it PNG (not every link-preview crawler reads WebP). For display, [_includes/image-src.html](_includes/image-src.html) swaps in a same-named `.webp` sibling when one exists in `site.static_files`; the home card and the project page both go through it, and the card (`card=true`) prefers a 960px `.card.webp` over that. A project with no `image:` gets the live DOGimg URL in its home card too, so every project ships a static PNG. Each one needs its own palette, layout and art style, since home shows every card side by side and lookalikes blur together: check `assets/images/projects/` before making a new one (a dotfiles draft that copied like-surgeon's look was redone).

### SEO signals live in the layout, not in _config.yml

[_layouts/default.html](_layouts/default.html) injects:

- WebSite JSON-LD with `alternateName` — homepage only (gated on `page.url == '/'`)
- Person JSON-LD with `sameAs` — `/about/` only
- `<link rel="alternate" hreflang>` (en / ko / x-default) — for any page with `translations:` in front matter
- `<meta name="robots" content="noindex">` — for any page with `noindex: true` (both resumes, which also stay out of the sitemap). Never block such a page in `robots.txt`, or crawlers can't read the tag
- SoftwareSourceCode JSON-LD (name, repo, author) — every project page, beside jekyll-seo-tag's CreativeWork. AI search answers bring most visitors to project pages, so this is what they cite a project by
- `<title>` as the bare post title, without `| site` — every post, since post titles are already near the result's width
- `<title>` as `title — tagline` instead of `title | site` — for any page with `tagline:` (every project, and About as "Zeikar — Founder of the Singular Gadget Lab"). `og:title` stays the bare title, since link previews show the description under it

When debugging Google/social cards, check the layout AND [_plugins/og_image.rb](_plugins/og_image.rb) before `_config.yml`.

### Analytics events

GA4 loads only in production builds ([_layouts/default.html](_layouts/default.html)). Its config sends `page_location` without the hash (the resume's `#name=` stays out of GA) and tags a browser that once opened `/?internal` as `traffic_type: internal`, which GA's Internal Traffic filter drops. Custom events, all in [assets/js/main.js](assets/js/main.js) except the bench's: `project_link` (`project`, `link_type` demo/github, `placement` project_page/card/post_unit) from any link with `data-track`, the key event, since demos on zeikar.dev never count as outbound clicks; `project_open` (`project`, `placement` bench/card/post_unit/post_meta/post_row/other); `language_switch` (`to_lang`); `resume_print` (`lang`); `bench_throw` (`project`, once per page, [assets/js/bench.js](assets/js/bench.js)). A new demo or source link gets the same `data-track` / `data-project` / `data-placement` attributes. An event fired by a click that navigates in the same tab (`project_open`, `language_switch`) would never reach GA, since the page unloads before gtag's batch goes out, so `trackOnLeave` parks one entry in sessionStorage with the destination path, and only that destination sends it. Its `page_location` is therefore the destination page; `page_referrer` and `placement` say where the click was. A new same-tab event goes through it too.

### Bilingual posts and resume

English posts live in `_posts/`, Korean in `_posts/ko/`. Permalinks differ by language (`/blog/:title/` vs `/blog/ko/:title/`), set via `defaults` in [_config.yml](_config.yml) — that block is **type-scoped to `posts`** so it doesn't rewrite `/about/`, `/resume/`, etc. Cross-link translations via:

```yaml
translations:
  ko: /blog/ko/some-post/
```

Both [_layouts/default.html](_layouts/default.html) (hreflang) and [_layouts/post.html](_layouts/post.html) (the other-language link on the meta line) read this field. The resume page pair (`/resume/` + `/resume-ko/`) also uses it. [blog.html](blog.html) reads `translations.ko` too: it lists each English post once with its Korean title underneath, and gives a Korean post its own row only when it has no `translations.en`. The row is [_includes/post-row.html](_includes/post-row.html), which home's Lab notes reuse.

Bricolage has no Hangul, so Korean text falls through `--font` to Pretendard, loaded from jsDelivr without blocking the first paint in [_layouts/default.html](_layouts/default.html).

A post about a project sets `unit: <project file name>` on both languages, or a list (`unit: [riroa, dotfiles]`) when it is about several; [_includes/unit-tape.html](_includes/unit-tape.html) turns it into one tape label per project on the index and the post page. It also links the two ways: the post ends with each project's card ("Filed under"), and each project page lists its English posts under Lab notes (Jekyll's `where` matches a value inside a list). A name that matches no project renders nothing.

### Resume PDF is the print stylesheet

The resume's PDF button only calls `window.print()`; the submission layout is the `@media print` block at the end of [_sass/_resume.scss](_sass/_resume.scss) (A4 via a named `@page resume`). Every selector there carries `.resume-page` because A4 width trips the 760px rules in `_responsive.scss`, which load later. The name at the top of the PDF is print-only and defaults to `site.author.name`; the real name is supplied only through a `#name=…` URL fragment read by [assets/js/main.js](assets/js/main.js). Never write the real name into the source.

### Sitemap is hand-rolled

The site does **not** use `jekyll-sitemap` despite the Gemfile listing — it's not in the `plugins:` array in [_config.yml](_config.yml). [sitemap.xml](sitemap.xml) is a manual sitemap *index* pointing at:

- [sitemap-main.xml](sitemap-main.xml) — pages, posts, projects, plus URLs from `extra_sitemap_urls:` in `_config.yml`
- `/<repo>/sitemap.xml` — one per *separate* Pages site in another repo that ships its own sitemap (atcoder, iki, javascript-30, …). Every repo with Pages on serves at `zeikar.dev/<repo>/`

If a new sub-Pages site lands under zeikar.dev, add its sitemap to both [sitemap.xml](sitemap.xml) and [robots.txt](robots.txt). A single-page one can skip its own sitemap, since its root joins sitemap-main through its project's `demo_url`. A URL that a sub-sitemap already lists stays out of `extra_sitemap_urls`.

### Project ordering

The curated display order ("listed here by preference") is [_data/project_order.yml](_data/project_order.yml), one project file name per line. [_plugins/project_order.rb](_plugins/project_order.rb) sorts `site.projects` by it at `post_read`, so the home page and [sitemap-main.xml](sitemap-main.xml) loop over `site.projects` unsorted; a project missing from the list goes last with a build warning. `gadget_no` is the UNIT number by build order and never changes. A new project needs a line in the list and a `gadget_no`, plus `tagline:` and `date:` (the repo's creation date): a collection doc without a date gets the build time, which jekyll-seo-tag then publishes as `datePublished` on every deploy. Front-matter dates are KST calendar dates (`timezone: Asia/Seoul` in [_config.yml](_config.yml)), so today's date is safe; a date after today is skipped until the first deploy on or after that date. A project's sitemap `<lastmod>` appears only when it sets `last_modified_at`. If `demo_url` is on `zeikar.dev`, it auto-joins the sitemap — don't also list it in `extra_sitemap_urls`.

Home lists every project on purpose: the resume's Independent Work is the curated short list, so don't split home into featured and the rest.

### Motion is page-scoped scripts

Home, About and the 404 load their own script after [assets/js/main.js](assets/js/main.js)'s site-wide one. Home's hero has a bench where every project's tape drops in by `gadget_no` and can be thrown: [index.html](index.html) renders the tapes with Liquid, and [assets/js/bench.js](assets/js/bench.js) runs them on Matter.js 0.20.0, committed as [assets/js/matter.min.js](assets/js/matter.min.js). It can't live in a `vendor/` folder: `.gitignore` drops every `vendor/` for Bundler. The bench is a toy copy of the catalogue, so it stays `aria-hidden` and out of the tab order, and a `<noscript>` style hides it when scripts are off. The `>_<` logo on About and the 404 looks toward the mouse and flinches when poked ([assets/js/face.js](assets/js/face.js), CSS in [_sass/_about.scss](_sass/_about.scss)). A bench tape that lands upside down stays put: making it hop to flip itself was tried and removed as awkward. A `>_` command palette (jump to a unit, search posts) was also turned down.

Site-wide, navigation is a cross-document view transition ([_sass/_layout.scss](_sass/_layout.scss)). A project page's title tape always carries `view-transition-name: unit-title`, and main.js gives the same name to the tape that was clicked (bench, card, post row, a post's unit card), so it grows into the title; back on home, the title flies into its card. Only one element per page may hold a name, or the transition is skipped, so never give it to a tape statically outside the project title. All of this honours `prefers-reduced-motion`: the bench shows the pile already settled and the transitions are off. Blog posts and the resume stay still.

### Colours are tokens, in two themes

Every colour comes from the custom properties in [_sass/_tokens.scss](_sass/_tokens.scss), which a `prefers-color-scheme: dark` block redefines (screen only, so a printed resume stays black on white). There's no toggle; the site follows the system. A literal colour in a partial breaks one of the two themes, so text on an ink or brand fill uses `--on-solid`, and a tint of ink is `color-mix(in srgb, var(--ink) N%, transparent)`. In dark, the black label tape becomes white tape with black letters. Code blocks stay dark in both themes. Giscus follows the system too (`preferred_color_scheme`).

### Manifest needs empty Jekyll front matter

[assets/images/site.webmanifest](assets/images/site.webmanifest) starts with `---` / `---` so Jekyll runs Liquid on it. Without that, `{{ site.title }}` ships as a literal string. The IDE will flag the file as invalid JSON — that's expected; Jekyll strips the front matter at build time.

## Content tone

Home and About copy is playful and confident. The humour is a mad scientist's lab with an otaku streak: a nod to Steins;Gate's Future Gadget Lab (gadgets numbered like lab equipment, grand names for small tools), the GitHub bio's "Ideas → Reality. Always shipping (•̀ᴗ•́)و", the `(>_<)` logo (a terminal prompt `>_` that one `<` turns into a face) and the cosmic address on About. Keep Steins;Gate a nod, not a copy: no "Future Gadget" wording. No jokes about projects failing, being abandoned or not working. Resume pages stay professional as deliberate contrast. Don't carry resume tone into home/about, or vice versa.

Project pages have no shared template. Open with a paragraph that says what the thing is, then build sections around that project's strongest technical points, with project-specific headings and details checked against the source repo. Each `##` heading is also an entry in the page's sticky contents list beside the text, which appears once a page has two. The old Overview / Key Features / Challenges / What I Learned / Impact skeleton is retired. `description` is both the card text and the hero summary; `tagline` is a short search title that says what the thing is (keep `title — tagline` near 60 characters), shown nowhere on the page. The card shows the first 6 `tech_stack` items, listed without version numbers. Link sibling projects as `/projects/<name>/`. Iki's copy anywhere (its page, the resume, About, cross-references from Charivo or LiveClaw) leads with a 2D rig engine whose headline strength is AI rigging; the Live2D comparison stays brief. The resume's Independent Work blurbs paraphrase project descriptions, so when a description's facts change, update `resume.html` and `resume-ko.html` too.

In `.html` page bodies, HTML-escape angle brackets in copy: `(&gt;_&lt;)`, not `(>_<)`. Kramdown only processes `.md`, but the HTML parser can still misread a bare `<`.

Blog post titles say plainly what the post is about, so a reader or a search knows the subject from the title alone; the story angle goes in the subtitle. When a post retells what the author told Claude in a session, paraphrase it in the post's voice instead of quoting the chat line as typed (ㅋㅋ and chat spelling read as unpolished).
