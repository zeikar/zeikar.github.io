---
title: "Korean IME in macOS WebKit Leaves Only the First Consonant (xterm.js, Monaco)"
subtitle: "Type Korean into xterm.js inside a Tauri app and most syllables come out as just their first consonant, because macOS WebKit sends Hangul composition without composition events. In the Monaco editor the same cause made the line shake, and the fix was different."
date: 2026-10-29
unit: vaquita
lang: en
translations:
  ko: /blog/ko/hangul-in-macos-webkit/
description: "Why Korean (Hangul) typed into xterm.js in a Tauri (WKWebView) app keeps only the first consonant of most syllables, and why the Monaco editor's line shakes: macOS WebKit sends insertReplacementText instead of composition events. How vaquita fixes both."
---

I'm building [vaquita](/projects/vaquita/), a macOS app for running coding agents like Claude Code and Codex across several terminals. It's built with Tauri, so the system WebKit (WKWebView) draws the window. The terminals are xterm.js and the file editor is Monaco.

Korean input broke this setup twice: first in the terminal, then again after I added the editor. Both came from the same place, but the symptoms and the fixes were different, so I'm writing them up together. In Electron, which is Chromium-based, composition events arrive as they should, so at least the terminal problem doesn't happen there. It only happens in apps that use the system WebKit.

## "안녕하세요" becomes "ㅇㄴㅎ세요" in the terminal

I opened a page running xterm.js 6.0 as-is in Safari and typed "안녕하세요 반갑습니다" ("Hello, nice to meet you") five times. This is what went in:

```
ㅇㄴㅎ요 ㅂㄱㄴ다
ㅇㄴㅎ세요 ㅂㄱㄴ
ㅇㄴㅎ세요 ㅂㄱ스ㄴ다
ㅇㄴㅎ세요 ㅂㄱ스ㄴ다
ㅇㄴㅎ세요 ㅂㄱㄴ
```

Most syllables are cut down to their first consonant, and which ones survive whole changes from one try to the next. Some background if you don't type Korean: Hangul letters, called jamo, combine into one block per syllable, so 안 is ㅇ, ㅏ and ㄴ in one block. The input method builds each block as you type its letters, and here only the first letter of most blocks got through. WKWebView inside the Tauri app does the same, and a plain `<textarea>` on that page takes the input fine.

## WebKit sends no composition events

On the web, characters that are composed as you type, like Hangul, usually arrive with `compositionstart`, `compositionupdate` and `compositionend` events. Editors and terminal libraries watch these to decide "this is still being composed, don't send it yet."

But typing with macOS's default 2-Set layout (두벌식, Dubeolsik, the standard Korean keyboard), WebKit sends none of these events. Logging the input events shows this:

```
insertText             "ㅇ"
insertReplacementText  "아"     replaces the previous character
insertReplacementText  "안"
insertReplacementText  "안"     confirmed on moving to the next syllable
insertText             "ㄴ"     a new syllable starts
...
```

The first jamo arrives as `insertText`, and each one after it as `insertReplacementText`, which swaps out the character just inserted. A WebKit engineer replied that this is expected, given how the system Korean input methods work ([WebKit bug 274700](https://bugs.webkit.org/show_bug.cgi?id=274700)). Firefox turns these replacements into a composition ([Mozilla bug 1341960](https://bugzilla.mozilla.org/show_bug.cgi?id=1341960)), while WebKit passes them through as they are.

xterm.js doesn't use these input events. It never looks at `insertReplacementText`, and it drops an `insertText` that follows a keypress too. Instead, when a key the input method handles (keyCode 229) is pressed, it waits a `setTimeout(0)`, compares the textarea with what it held before the key, and sends that (`_handleAnyTextareaChanges` in `CompositionHelper`). That's meant as a fallback for typing numbers or punctuation with an input method on, but with no composition events, every Hangul jamo goes out this way. The comparison doesn't keep up with characters being replaced in place, so the first jamo of a syllable gets out and most of the replacements after it are lost.

Which syllables survive whole also changed with typing speed. Typed slowly, "반갑습니다" came out as `ㅂㄱ스ㄴ다`; typed fast, as `ㅂㄱㄴ다`. I didn't work out why speed makes the difference.

## In xterm.js, hold the syllable and send it later

Once a terminal sends a character, the program on the other end already has it. Sending backspaces to erase it isn't reliable either, since every program handles them its own way. So the syllable being composed isn't sent. It's held until I can be sure it's finished.

```ts
input(inputType: string, data: string) {
  if (inputType === 'insertText') {
    this.flush();          // the previous syllable is finished, so send it
    this.pending = data;   // a new syllable starts
  } else if (inputType === 'insertReplacementText') {
    this.pending = data;   // only replace the syllable being composed
  }
}
```

That alone wasn't enough, so a few more things needed care:

- The events are intercepted in the capture phase with `stopPropagation` only, never `preventDefault`. The input method replaces text based on what's in the textarea, so the text has to stay there.
- The syllable being composed hasn't gone to the PTY yet, so the terminal doesn't show it. Instead, an underlined copy is drawn over the cursor and repositioned whenever the cursor moves or output arrives. Otherwise, when the echo comes back late, the copy covers the previous character.
- The held syllable is sent when the next syllable's `insertText` arrives, just before xterm sends something like Enter, an arrow or a Ctrl key, when the textarea or the window loses focus, and when the terminal is clicked.
- After a click sends the syllable, the input method still thinks it's composing. Type the next jamo and it tries to replace the character just sent, so the textarea is `blur()`ed and `focus()`ed again to reset the input method.
- Right after Enter sends a syllable, one more confirming replacement with the same character can arrive. Left alone, it would enter the syllable twice, so it's ignored.

With that, "안녕하세요 반갑습니다" goes in correctly. Deleting jamo with backspace (갃 to 각 to 가, one letter off the block at a time) is handled by the input method as replacements too. Only deleting the last jamo arrives as `deleteContentBackward`; that syllable was never sent, so it's intercepted to keep xterm from sending a DEL to the PTY.

xterm.js has an open [PR #5704](https://github.com/xtermjs/xterm.js/pull/5704) that fixes the same problem. The maintainer has asked for it to be split out into a WebKit-only class that emulates composition. Once it's merged, I plan to drop my workaround.

## Monaco gets the text right, but the line shakes

When I later added Monaco as the file editor, a different symptom appeared. Typing Korean felt a beat behind, and the line jumped up and down a few pixels with every character.

At first I assumed it was the xterm.js problem again, but reading Monaco's code showed it handles the text itself correctly. Monaco compares its hidden textarea's content with the previous state every time, so it correctly reads `insertReplacementText` as "replace the one character before." I also considered injecting fake composition events, but that puts Monaco on the path that shows its composition overlay, and that's the very path where #4796 traced the shaking, so I dropped it.

The shaking comes from the hidden textarea's scroll. WebKit has no EditContext API, so Monaco takes input through a hidden textarea. With the default setting (`accessibilitySupport: 'auto'`), Monaco fills this textarea with plenty of text around the cursor for screen readers, and sets its `scrollTop` itself, in whole multiples of the line height. But WebKit also scrolls the textarea on its own each time a character goes in, to keep the cursor visible, and it lands 3px off from Monaco's value. Monaco sets it back, the next character knocks it off again, and while the textarea is visible over the line, this tug-of-war shows up as shaking. I didn't confirm exactly when the textarea becomes visible, but this one option made the shaking go away:

```ts
monaco.editor.create(host, {
  // ...
  accessibilitySupport: 'off',
});
```

With `'off'`, the textarea holds only about the word before the cursor, so its scroll stays at 0. There was already an issue about lines jumping up and down while typing Chinese in Safari ([monaco-editor#4796](https://github.com/microsoft/monaco-editor/issues/4796)), and someone who hit the same thing in a Tauri app had posted this option there. The cost is the text around the cursor that a screen reader could read. Standalone Monaco can't detect a screen reader, so `'auto'` never enters screen-reader-optimized mode, and that text is all you give up.

vaquita's actual code is on GitHub: [`hangul.ts`](https://github.com/zeikar/vaquita/blob/main/app/src/lib/hangul.ts) and [`hangul-fix.ts`](https://github.com/zeikar/vaquita/blob/main/app/src/lib/hangul-fix.ts) for the terminal, and [`TextEditor.svelte`](https://github.com/zeikar/vaquita/blob/main/app/src/lib/TextEditor.svelte) for the editor.
