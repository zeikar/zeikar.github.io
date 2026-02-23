---
layout: project
title: "DOGimg"
description: "Dynamic Open Graph image generator that creates share-ready preview cards from any URL."
tech_stack: ["Next.js 13", "TypeScript", "@vercel/og", "Tailwind CSS", "Vercel"]
github_url: "https://github.com/zeikar/dogimg"
demo_url: "https://dogimg.vercel.app"
image: "/assets/images/projects/dogimg.png"
sequence: 3
---

## Project Overview

DOGimg is a utility product for generating Open Graph images directly from a webpage URL. It helps creators and developers quickly produce social preview images without manual design work.

## Key Features

- **URL-based Generation**: Create OG images by passing a target URL
- **API-first Usage**: Direct endpoint integration for automated workflows
- **Meta Data Extraction**: Uses page title, description, and favicon as generation inputs
- **Share-ready Output**: Designed for social link previews and SEO snippets
- **Simple Local Run**: Works locally with standard Next.js development setup

## Technical Challenges & Solutions

### Challenge 1: Reliable source extraction
Implemented HTML parsing to consistently collect key metadata from arbitrary webpages.

### Challenge 2: Render quality in API responses
Used `@vercel/og`-based rendering so generated images remain fast and visually consistent.

### Challenge 3: Practical integration path
Kept the API contract simple (`/api/og?url=...`) so it can be plugged into existing sites with minimal effort.

## What I Learned

- Building focused API tools on top of Next.js route handlers
- Converting page metadata into visual output pipelines
- Designing utility products with low integration friction
- Balancing simplicity and output quality for SEO-focused tooling

## Impact

DOGimg reduces the effort required to produce social preview assets and makes OG-image workflows easier to automate.
