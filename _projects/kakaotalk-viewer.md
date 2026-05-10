---
layout: project
title: "KakaoTalk Viewer"
description: "Browser-only viewer for KakaoTalk export files with search, date navigation, and multi-platform parser support."
tech_stack: ["Preact", "TypeScript", "Vite", "Tailwind CSS", "Vitest"]
github_url: "https://github.com/zeikar/kakaotalk-viewer"
demo_url: "https://zeikar.dev/kakaotalk-viewer/"
image: "/assets/images/projects/kakaotalk-viewer.png"
sequence: 12
---

## Project Overview

KakaoTalk Viewer is a browser-based viewer for KakaoTalk export files. It renders exported `.txt` and `.csv` chat logs in a familiar messenger-style interface, so users can inspect long conversation histories without installing a desktop app or uploading private chat data to a server.

## Key Features

- **Multi-platform Parsing**: Supports KakaoTalk exports from Windows, macOS, Android, and iOS
- **Private Browser-only Workflow**: Reads and renders files locally in the browser without server upload
- **Search & Date Navigation**: Find messages quickly and jump by date, oldest message, or latest message
- **Messenger-style Rendering**: Preserves date headers, invite/leave notifications, multiline messages, and links
- **Large Chat Performance**: Uses virtual scrolling to keep long conversation histories responsive
- **Static Deployment**: Runs as a GitHub Pages app with no backend dependency

## Technical Challenges & Solutions

### Challenge 1: Export format differences
Built separate parsers for Windows, macOS, Android, and iOS exports, including Korean and English locale variations, 12-hour/24-hour time formats, CSV quoting, multiline messages, and system notifications.

### Challenge 2: Navigating long histories
Added virtualized rendering, message search, date indexing, and calendar-based jumps so old chat rooms remain fast and practical to browse.

### Challenge 3: Privacy-sensitive file handling
Kept all parsing on the client side. The selected export file is read through browser APIs and never needs to leave the user's local browser session.

## What I Learned

- Designing parser-driven frontend tools with strong test coverage
- Handling platform, locale, and timestamp differences in real-world text exports
- Building usable navigation for dense conversation logs
- Keeping privacy-sensitive utilities simple through static deployment

## Impact

KakaoTalk Viewer makes exported conversation data easier to inspect, search, and revisit while keeping private chat files local to the user's browser.
