---
layout: project
title: "Commentarium"
description: "Chrome extension that adds a social layer to any page with ratings, comments, and community voting."
tech_stack: ["Chrome Extension APIs", "React 18", "TypeScript", "Vite", "Jest"]
github_url: "https://github.com/zeikar/commentarium-extension"
demo_url: "https://commentarium.app"
image: "/assets/images/projects/commentarium.png"
sequence: 4
---

## Project Overview

Commentarium is a browser extension that makes the web conversational by letting users leave opinions and discover community sentiment directly on any site.

## Key Features

- **Universal Page Rating**: Apply ratings across arbitrary web pages
- **Contextual Comments**: Add and browse comments tied to the current URL
- **Voting Mechanics**: Upvote/downvote interactions to surface quality discussions
- **Cross-site Compatibility**: Content scripts designed for heterogeneous web structures
- **Fast Iteration Workflow**: Vite-based build and reload loop for extension development

## Technical Challenges & Solutions

### Challenge 1: Injection reliability
Handled content script behavior across different DOM structures and loading strategies without breaking host pages.

### Challenge 2: Real-time Social Features
Implemented interaction flows for comments and votes while keeping extension UI responsive.

### Challenge 3: Cross-Site Compatibility
Built predictable extension packaging and manifest workflows for stable cross-page behavior.

## What I Learned

- Chrome extension architecture and permission boundaries
- Practical TypeScript patterns in browser extension contexts
- Testing and maintaining extension-specific UI with Jest + React
- Product tradeoffs for social signals on top of existing web surfaces

## Impact

Commentarium enables users to discover new perspectives, share insights, and build communities around any web content, making the internet a more interactive and collaborative space.
