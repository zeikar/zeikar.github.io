# zeikar.github.io

This repository powers my personal portfolio and project archive site.  
It is a Jekyll-based static site deployed to `https://zeikar.github.io` via GitHub Pages.

The site currently includes:

- A portfolio landing page
- An about page
- Project detail pages generated from the `_projects` collection
- Root `sitemap.xml` index and `robots.txt`
- Manually maintained `sitemap-main.xml`

## Project Structure

```text
.
├── _config.yml            # Jekyll configuration
├── index.html             # Home page
├── about.html             # About page
├── _projects/             # Project detail content
├── _layouts/              # Layout templates
├── _includes/             # Shared UI partials
├── assets/                # CSS, JS, images
├── sitemap.xml            # Root sitemap index
├── sitemap-main.xml       # Main site sitemap
└── robots.txt             # Crawl directives
```

## Local Development

### 1. Requirements

- Ruby
- Bundler

Node.js is not required.

### 2. Install Dependencies

```bash
bundle install
```

### 3. Run the Development Server

```bash
bundle exec jekyll serve
```

Default local URL:

```text
http://127.0.0.1:4000
```

Jekyll will rebuild automatically when files change.

## Production Build

Generate the static site:

```bash
bundle exec jekyll build
```

The output is generated in the `_site/` directory.

## Content Workflow

### Add a New Project

Add a Markdown file under `_projects/` with front matter like this:

```md
---
layout: project
title: "My Project"
description: "Short summary"
tech_stack: ["Jekyll", "GitHub Pages"]
github_url: "https://github.com/zeikar/my-project"
demo_url: "https://zeikar.github.io/my-project/"
sequence: 99
---
```

The `sequence` field controls the ordering on the home page.

### Add Extra Sitemap URLs

- If a file in `_projects/*.md` has a `demo_url` under `https://zeikar.github.io`, it will be included in `sitemap-main.xml` automatically.
- If a URL should be included separately from project content, add it to `extra_sitemap_urls` in `_config.yml`.

## Notes

- Core site settings are managed in `_config.yml`.
- SEO metadata is handled with `jekyll-seo-tag`.
- Feed generation uses `jekyll-feed`.
