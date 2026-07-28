---
layout: project
title: "Captiony"
description: "Web-based subtitle editor for fast, precise SRT/VTT authoring with timeline controls and local auto-save."
tech_stack: ["Next.js 15", "React 19", "TypeScript", "Tailwind CSS 4", "Zustand"]
github_url: "https://github.com/zeikar/captiony"
demo_url: "https://captiony.vercel.app"
image: "/assets/images/projects/captiony.png"
sequence: 9
gadget_no: 11
---

Captiony is a browser-based subtitle editor — upload a video, lay captions onto a timeline, preview them over the video as you go, and export an SRT or VTT file. No desktop install, no upload to a server.

## What's in it

- **Timeline editing** — drag and resize subtitle bars to set timing; zoom in for frame-level precision or out for the whole clip
- **Two timeline modes** — *Free* (you pan around) and *Centered* (the playhead stays put while the timeline scrolls under it, which is easier on long sessions)
- **Live preview** — subtitles render over the playing video, so bad timing shows up immediately
- **SRT & VTT round-trip** — import and export both formats
- **Autosave + exit protection** — work persists to `localStorage`, and the page warns before you navigate away
- **Keyboard-driven** — `Space` to play/pause, `←/→` to seek, `↑/↓` to move between cues, `Enter` to edit, `+/-` to zoom the timeline

The whole editor runs client-side. That keeps it fast and means the video file never leaves the browser.
