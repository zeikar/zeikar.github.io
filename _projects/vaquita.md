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
sequence: 9
gadget_no: 27
date: 2026-10-21
---

vaquita is a lightweight agentic development environment for macOS: AI coding agents, Claude Code and Codex CLI, run side by side in the repos they work on, with the repo's files and an editor beside the terminal. The sidebar lists each repo with its sessions under it, and every session shows what its agent is doing: a spinner while it works, ⚠ with the permission or question it's waiting on, ✓ or ✗ when the turn ends, and a dot until you've looked. The repo's files sit in a tree on the right, and a file opens in a tab beside the terminal: code in an editor, Markdown as a preview, media as itself. A Go daemon holds the terminals, so agents keep running when the app quits or updates itself. It runs the `claude` and `codex` you already have, writes nothing into their settings, and the [latest release](https://github.com/zeikar/vaquita/releases/latest) is a zip of about 10 MB for Apple Silicon Macs.

## Status from escape sequences, not hooks

Everything the sidebar knows comes from what the agents already print to their terminal. The daemon runs each session's output through its own scanner, which follows the escape-sequence structure without emulating a terminal, and picks out three things:

- **OSC 7501 status reports.** The app's terminal answers the agent's `OSC 7501 ?` probe with the states and kinds it understands, and the reports say idle, working, done, error, or blocked on a permission, a question or a login, with a message to show.
- **Codex's OSC 9 notifications.** A session whose command starts with `codex` gets `-c` options that turn them on for that session only: finished turns, approval requests, plan-mode prompts and questions.
- **Window titles,** which name the session: Claude Code's topic for the conversation, or Codex's thread name, which those same options make the title.

OSC 9 needs a filter, since Windows Terminal and ConEmu reuse it for things like `9;4` progress bars that Cargo emits constantly; a numeric first field means it isn't a notification. The scanner keeps at most 4 KB of a status report and abandons any string that hasn't ended after 64 KB, so runaway output can't grow its memory, and both it and the output path around it have fuzz tests.

## Telling a finished turn from a dead agent

The two agents end a turn differently. Claude Code sends done, then a second done with a summary about 2.5 seconds later. Codex never sends done: a finished turn is an OSC 9 carrying its last reply followed by idle, while a cancel or a denial is a bare idle. So a done is only notified after a working, once it has stood for 1.5 seconds with a message or 3 seconds without one, because agents flicker from done back to working. An idle only means done for Codex, right after an OSC 9.

An agent killed with SIGKILL reports nothing. While one is up, the daemon polls the PTY's foreground process group every second, and once the shell has the terminal back, the agent is gone. Its working or waiting state is cleared, and the terminal modes it left on are undone; with mouse tracking left on, every mouse move over the terminal would type into the shell. The process group alone isn't proof, since a helper like the `caffeinate` Claude Code starts can outlive the agent there for minutes.

## A daemon holds the terminals

Each session is a shell in its own PTY inside `vaquitad`, which launchd runs. It ships inside the bundle as a helper app with the app's bundle id, icon and signing identifier, so the folder access macOS asks for on the daemon's behalf is listed under one "vaquita" in Privacy & Security, not a second "vaquitad" with a blank icon. The release app installs the LaunchAgent itself, pointing at that helper, and the plist stays in vaquita's folder rather than `~/Library/LaunchAgents`, so nothing starts at login. The app connects over a WebSocket on 127.0.0.1: a random port, a token in an owner-only `endpoint.json`, and an Origin check that admits the Tauri webview. Output travels as binary frames with a 9-byte header: type, session id and generation.

- **Replay that starts on a clean edge.** Every session keeps its last 1 MB of output in a ring buffer, so a reconnecting app gets its screens back by replay. Cutting into an escape sequence or a UTF-8 character would garble that, so the scanner records cut boundaries as output arrives and eviction moves the ring's start to one where it can. A second scanner reads exactly the bytes the ring evicts, so it knows which modes were in effect at the start (alternate screen, mouse tracking, bracketed paste, the kitty keyboard flags), and the replay sets them first.
- **Backpressure.** The app acknowledges output once xterm.js has parsed it, and the daemon stops sending at 1 MB unacknowledged, so a program flooding its terminal can't grow the webview's write queue without bound.
- **One writer.** `vaquitad attach` can watch a session from another terminal, but only one client takes input and resizes, the app whenever it's connected. Only its terminal's answers to queries reach the program, so a byte is never answered twice.

## Resuming the conversation after a reboot

Sessions outlive a daemon restart as records in `state.json`. While an agent runs, the daemon notes its conversation id, the one `--resume` takes, without asking the agent. Claude Code keeps a file per process under `~/.claude/sessions`, so the daemon reads it by pid, and rejects one that claims a start more than 15 seconds before that process's own: a SIGKILLed claude leaves its file behind for whatever gets the pid next. Codex has no such file, so the daemon takes the newest conversation file under `~/.codex/sessions` that started in the session's folder since the session began and isn't claimed by another session, reading at most 200 files. That can occasionally pick another conversation, and the docs say so.

After a crash or a reboot, the app lists the earlier sessions with Reopen and Dismiss. Reopen runs `claude --resume <id>` or `codex resume <id>` in the same folder, falls back to `claude --continue` or `codex resume --last` when no id was noted, and gives a session that ran no agent a plain shell. Right after a crash, agents still shutting down can hold a session's processes, so the daemon checks those sessions again over the first 15 seconds and makes them reopenable once they're gone.

## xterm.js inside WebKit

The app is Tauri 2 with Svelte 5 and xterm.js, so every terminal lives in macOS's WKWebView, which needed a few fixes of its own.

- **Korean input.** WebKit's macOS Korean IME sends no composition events: a syllable starts with an `insertText`, and every later jamo replaces it with an `insertReplacementText`, which xterm.js ignores. vaquita holds the syllable being composed, draws it over the cursor, and sends it once the next one starts or anything else is about to go out. The IME's behaviour was checked first in a WKWebView test bed in `tools/probe`.
- **Background sessions.** Each session has its own xterm.js terminal that keeps parsing output while hidden, so its agent's status probe and colour queries still get answers, but only the one on screen has a WebGL context. A terminal never shown is never opened, and xterm.js only answers colour queries once opened, so the app answers OSC 10, 11, 12 and palette queries itself.
- **Paths bounded by colour.** Agents colour the paths they print, so a path that isn't a hyperlink ends where its colour does, also one joined across lines. Claude Code draws a path in backticks in a colour of its own, so a Korean particle written right onto it, as in `~/.zshrc을`, stays out of the link without any language-specific trimming. A path an agent wraps onto the next line itself, indenting the rest, is joined back while each part but the last reaches the right edge; if the joined path doesn't exist, ⌘-click opens the part under the pointer.
- **File links from untrusted output.** ⌘-click opens a path or a `file://` link in a tab of the app, or else in its default app, and the daemon sets `FORCE_HYPERLINK=1` so agents emit those links. The Rust side resolves the path first, then reveals it in Finder instead when opening it could run something: an executable, anything in an app bundle, a script, a stored link like `.webloc`, or a file whose default app runs or installs what it opens, such as Terminal, Installer or Shortcuts.

## A file tree that watches only what's open

The panel on the right shows the selected session's repo as a tree that follows the disk without polling anything. A folder is read when it's expanded, and only expanded folders are watched with FSEvents, each one non-recursively, so an agent writing deep inside the repo costs one filtered callback and nothing sent to the webview; with no folder expanded no watcher thread runs, and a hidden panel reads and watches nothing. A change to a file's contents alone can't change a listing, so it's dropped too, except a write to a `.gitignore`.

What git ignores, such as `node_modules` or `.env`, is dimmed. Git is asked only when a folder is read, with the folder's names passed to `git check-ignore` on stdin and `core.fsmonitor` off, since a repository's config could otherwise name a command for git to run. A folder lists at most 2000 entries, and a symlink is a row, not a branch: it opens like a file.

## Editing files an agent also writes

Files open in tabs after the terminal, which is always the first: text and code up to 2 MiB that's valid UTF-8 in a Monaco editor, Markdown as a preview with its source a click away, and images, audio and video as themselves. A click in the tree or a ⌘-click opens a preview tab that the next file replaces, so looking through what an agent touched doesn't pile up tabs; an edit or a double-click keeps it.

Agents write to the same files, so each text tab keeps the modification time and length of the file its text came from. A tab you haven't edited reads the file again each time it's shown and takes the new text if either changed, so an agent's edits appear. An edited tab keeps its text, and a save sends that stamp back: if the file no longer matches, the app asks before overwriting it. The text goes to a new temporary file beside the original, the stamp is checked once more just before the rename over it, and `fcopyfile` carries over the original's mode, owner, flags, ACLs and extended attributes such as Finder tags. A failed write, on a full disk say, leaves the original intact. Closing an edited tab, the window, or the app for an update asks first; ⌘Q doesn't.

File contents are as untrusted as terminal output. The Markdown preview is sanitized (no scripts, images, media, SVG, forms, styles, classes or ids) and its links open only http, https and mailto, in the browser. Media comes through Tauri's asset protocol, which serves any file whose type it can't tell as HTML, so a page named `.png` would render. Its URLs only ever go into `<img>`, `<audio>` and `<video>`, which never render HTML, and are never framed or navigated to. PDFs open in their default app, since WebKit showed them blank in a sandboxed frame.

Korean typing needed a fix here too. WebKit has no EditContext, so typing goes through Monaco's hidden textarea, and with Monaco's accessibility support at its default, that textarea holds a page of text that WebKit scrolls a few pixels off Monaco's alignment, which shook the line while the IME composed. vaquita turns it off.

## Updating without ending sessions

The app updates itself. It checks the latest release's feed 15 seconds after launch and every six hours, and a notice offers a newer version; one click downloads the archive, checks its minisign signature against the public key the app ships with, swaps the new bundle in for itself (one step on APFS) and relaunches. The signature also names the version it was made for, which must be the feed's, so an altered feed can't pass an older release off as a newer one. The update stays in Rust from check to install: the webview has no updater permission, only ever learns a version, and never names a URL. The app downloaded the archive itself, so the new bundle has no quarantine flag. It relaunches with `open` after quitting, so it keeps its Dock tile.

Sessions keep running through the update, in the daemon, which goes on running its old binary until the relaunched app checks its build. A daemon's build carries a fingerprint of its committed code, so a release that leaves the daemon alone ships the same build and restarts nothing. When the daemon has changed, the app swaps it only while no session is running, and the daemon agrees to stop only if that's still true. Otherwise a notice offers the restart, since running sessions end with it.

## About 200 MB until the editor loads

Measured with a release build, before the files panel was added: 13 shell sessions, 9 of them holding about 300 lines of output, one of those on screen, left idle for a minute. The app, its three WebKit processes and the daemon came to about 205 MB of memory together (32 MB for the app, 156 for WebKit, 16 for the daemon), about 110 MB with 10 sessions and none on screen, and idle CPU was 0%. The daemon is built without its symbol table and DWARF, which makes it a third smaller.

Monaco is the heaviest part, about 1.3 MB of the download and about 100 MB of memory, so it's a chunk of its own behind one dynamic import that the first text tab triggers, and a run that only uses terminals never fetches it. Opening that first file brings the total to about 320 MB, and Monaco stays loaded until the app restarts, at about 300 MB with its tab closed. It ships without Monaco's CSS, HTML, JSON and TypeScript language workers, keeping highlighting for every language, so the editor worker is the only one.

vaquita is at 0.1.16, Apple Silicon only. The app is signed with a self-signed certificate and not notarized, so the README has the one command that clears the quarantine flag on the first install; releases after that arrive in the app.
