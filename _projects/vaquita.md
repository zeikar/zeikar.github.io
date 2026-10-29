---
layout: project
title: "vaquita"
description: "A lightweight macOS app for running Claude Code and Codex side by side: every agent's state in one sidebar, the repo's files and an editor beside the terminal, and no hooks to install."
tagline: "Agentic Dev Environment for Claude Code & Codex"
tech_stack: ["Go", "Tauri", "Svelte", "xterm.js", "Claude Code", "Codex CLI", "Monaco", "Rust", "TypeScript", "WebSocket"]
github_url: "https://github.com/zeikar/vaquita"
demo_url: "https://github.com/zeikar/vaquita/releases/latest"
demo_label: "Download for macOS"
image: "/assets/images/projects/vaquita.png"
sequence: 5
gadget_no: 27
date: 2026-10-21
---

vaquita is a lightweight agentic development environment for macOS: Claude Code and Codex CLI run side by side in the repos they work on, with the repo's files and an editor beside the terminal. The sidebar lists each repo with its sessions, and every session shows what its agent is doing: a spinner while it works, ⚠ with the permission or question it's waiting on, ✓ or ✗ when the turn ends. A Go daemon holds the terminals, so agents keep running when the app quits or updates itself. It runs the `claude` and `codex` you already have and writes nothing into their settings. The [latest release](https://github.com/zeikar/vaquita/releases/latest) is a zip of about 10 MB for Apple Silicon Macs.

## Status from escape sequences, not hooks

Everything the sidebar knows comes from what the agents already print. The daemon scans each session's output, without emulating a terminal, for three things: OSC 7501 status reports (working, done, or blocked on a permission, a question or a login), which Claude Code sends only once the terminal answers its probe; Codex's OSC 9 notifications, which vaquita turns on with per-session `-c` options; and window titles, which name the session. The scanner caps what it buffers, so runaway output can't grow its memory, and it is fuzz-tested.

The hard part is knowing when a turn is over. Claude Code sends done twice, the second with a summary; Codex never sends done, and a finished turn is an OSC 9 followed by idle. So vaquita notifies only once a turn's end has stood for a moment. An agent killed with SIGKILL reports nothing at all, so the daemon watches the PTY's foreground process group to catch it. [Reading Agent Status Without Hooks](/blog/reading-agent-status-without-hooks/) has the full story.

## A daemon holds the terminals

Each session is a shell in its own PTY inside `vaquitad`, which launchd runs from a helper app inside the bundle, so macOS lists its folder access under one "vaquita" in Privacy & Security, and its plist stays out of `~/Library/LaunchAgents`, so nothing starts at login. The app connects over a WebSocket on 127.0.0.1 with a random port, a token in an owner-only file and an Origin check.

- **Replay that starts on a clean edge.** Every session keeps its last 1 MB of output in a ring buffer, and a reconnecting app gets its screens back by replay. Eviction cuts, where it can, only where no escape sequence or UTF-8 character is split, and a second scanner tracks which modes (alternate screen, mouse tracking, bracketed paste) were on at the cut, so the replay sets them first.
- **Backpressure.** The daemon stops sending once 1 MB is waiting on the app's acknowledgement, so a program flooding its terminal can't grow the webview's queue without bound.
- **Resuming after a reboot.** While an agent runs, the daemon notes its conversation id without asking it: from Claude Code's per-process file under `~/.claude/sessions`, or the newest matching conversation under `~/.codex/sessions`, which can occasionally pick another one. After a crash or reboot, Reopen runs `claude --resume <id>` or `codex resume <id>` in the same folder.

## xterm.js inside WebKit

The app is Tauri 2 with Svelte 5 and xterm.js, so every terminal lives in macOS's WKWebView, which needed fixes of its own. Korean typing came out as bare consonants, because WebKit sends Hangul without composition events. vaquita holds each syllable until it's finished; [Korean IME in macOS WebKit](/blog/hangul-in-macos-webkit/) covers that and the editor's version of it. Hidden sessions keep parsing output so their agents' queries still get answers, but only the one on screen has a WebGL context.

⌘-click on a path an agent printed opens it in a tab, or else in its default app. A path ends where the agent's colour for it ends, so a Korean particle written right onto it, as in `~/.zshrc을`, stays out of the link, and a path the agent wrapped onto the next line is joined back. Output is untrusted, so anything that could run when opened, like an executable, a script or an installer, is revealed in Finder instead.

## Files an agent also writes

The panel on the right shows the repo as a tree. A folder is read when it's expanded, and only expanded folders are watched with FSEvents, so an agent writing deep inside the repo sends nothing to the webview. What git ignores is dimmed.

Files open in tabs beside the terminal: code in a Monaco editor, Markdown as a sanitized preview, media as itself. Agents write to the same files, so each tab remembers the modification time and length its text came from. A tab you haven't edited picks up an agent's changes when shown; a save checks that stamp, asking first if the file changed, and writes through a temporary file renamed over the original, keeping its permissions, ACLs and Finder tags.

## Updating without ending sessions

The app updates itself: it checks the release feed, and once you click Update it downloads the archive and verifies its minisign signature, which must also name the feed's version, before swapping itself in. The whole path stays in Rust, and the webview never names a URL. Sessions keep running in the daemon, and a daemon build carries a fingerprint of its code, so a release that leaves the daemon alone restarts nothing. When it has changed, the app swaps it only while no session is running.

## About 200 MB until the editor loads

Measured with a release build before the files panel was added, 13 shell sessions with one on screen came to about 205 MB for the app, WebKit and the daemon together, with idle CPU at 0%. Monaco is the heaviest part, so it loads behind a dynamic import on the first text tab, and a run that only uses terminals never fetches it; with it loaded the total is about 320 MB.

vaquita is at 0.1.16, Apple Silicon only. The app is signed with a self-signed certificate and not notarized, so the README has the one command that clears the quarantine flag on the first install; releases after that arrive in the app.
