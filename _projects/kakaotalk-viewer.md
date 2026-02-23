---
layout: project
title: "KakaoTalk Viewer"
description: "Web-based viewer for exported KakaoTalk chats, with UI inspired by real messenger conversation layouts."
tech_stack: ["JavaScript", "HTML", "CSS", "GitHub Pages"]
github_url: "https://github.com/zeikar/kakaotalk-viewer"
demo_url: "https://zeikar.github.io/kakaotalk-viewer/"
image: "/assets/images/projects/kakaotalk-viewer.png"
sequence: 8
---

## Project Overview

KakaoTalk Viewer is a simple web viewer for KakaoTalk export files. It focuses on quickly rendering chat logs in a familiar conversation-style interface so users can review history more comfortably.

## Key Features

- **Exported Chat Rendering**: Displays exported KakaoTalk text conversations in a readable UI
- **Messenger-style Layout**: Interface inspired by KakaoTalk chat visuals
- **Browser-only Usage**: Runs as a static web app without backend setup
- **Cross-platform Export Support**: Handles export formats from major KakaoTalk environments
- **Instant Access via GitHub Pages**: Hosted for immediate use and sharing

## Technical Challenges & Solutions

### Challenge 1: Export format differences
Adjusted parsing and display logic to account for differences in exported data from Windows, macOS, and Android versions.

### Challenge 2: Familiar visual structure
Implemented message grouping and bubble-style rendering so logs feel closer to real chat context.

### Challenge 3: Zero-backend simplicity
Kept the app fully static and lightweight for easy deployment and low maintenance overhead.

## What I Learned

- Building parser-driven frontends with plain JavaScript
- Handling text-format edge cases across platform versions
- Improving readability of dense conversation logs
- Shipping utility tools quickly with static hosting

## Impact

KakaoTalk Viewer makes exported conversation data easier to inspect and share, especially when users need quick, visual review outside the KakaoTalk app.
