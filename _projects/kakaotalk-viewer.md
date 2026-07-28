---
layout: project
title: "KakaoTalk Viewer"
description: "Browser-only viewer for KakaoTalk export files with search, date navigation, and multi-platform parser support."
tech_stack: ["Preact", "TypeScript", "Vite", "Tailwind CSS", "Vitest"]
github_url: "https://github.com/zeikar/kakaotalk-viewer"
demo_url: "https://zeikar.dev/kakaotalk-viewer/"
image: "/assets/images/projects/kakaotalk-viewer.png"
sequence: 14
gadget_no: 3
---

KakaoTalk Viewer opens exported KakaoTalk chat files in the browser and renders them like the real messenger — date dividers, multiline messages, join/leave notices, links — so a long backed-up conversation is actually readable. Everything happens client-side; the chat file never leaves your browser.

## What it handles

- **Every export source** — auto-detects KakaoTalk `.txt`/`.csv` exports from Windows, macOS, Android, and iOS, across Korean and English locale formats (12- and 24-hour time, CSV quoting, system messages)
- **Navigation that scales** — full-text search, per-person filtering, jump-to-date, and jump to the first or last message
- **"Which messages are mine?"** — pick your own name and your side of the conversation lines up correctly
- **Long rooms stay smooth** — virtualized rendering (react-virtuoso) so a chat with tens of thousands of lines doesn't choke

## Parsing is the real work

The interesting part isn't the UI, it's the parsers. Each platform exports a slightly different shape, so `src/parser/**` carries per-platform logic for those differences — and both `src/parser/**` and `src/lib/**` are held to **100% test coverage** in CI, because a parser that's right 95% of the time silently mangles the other 5% of someone's chat history.
