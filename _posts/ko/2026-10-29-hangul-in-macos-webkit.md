---
title: "macOS WebKit에서 한글이 자음만 남는 문제 (xterm.js, Monaco)"
subtitle: "Tauri 앱 안의 xterm.js에 한글을 치면 음절 대부분이 첫 자음만 남는다. macOS WebKit이 한글 조합을 composition 이벤트 없이 보내기 때문이다. Monaco 편집기에서는 같은 원인으로 줄이 흔들렸고, 고치는 법도 달랐다."
date: 2026-10-29
unit: vaquita
translations:
  en: /blog/hangul-in-macos-webkit/
description: "Tauri(WKWebView) 앱의 xterm.js에 한글을 치면 첫 자음만 입력되고, Monaco 편집기에서는 줄이 흔들린다. macOS WebKit이 composition 이벤트 대신 insertReplacementText를 보내서 생기는 문제이고, vaquita에서는 둘을 다르게 고쳤다."
---

요즘 [vaquita](/projects/vaquita/)라는 macOS 앱을 만들고 있다. Claude Code나 Codex 같은 코딩 에이전트를 터미널 여러 개에 띄워 두고 쓰는 앱이다. Tauri로 만들어서 화면은 시스템 WebKit(WKWebView)이 그리고, 터미널은 xterm.js, 파일 편집기는 Monaco를 쓴다.

이 조합에서 한글 때문에 두 번 막혔다. 처음엔 터미널에서, 나중에 편집기를 넣고 나서 한 번 더. 원인은 같은 곳에서 나왔는데 증상과 고치는 법이 달라서 같이 정리해 둔다. Chromium 기반인 Electron에서는 composition 이벤트가 제대로 와서 적어도 터미널 쪽 문제는 생기지 않는다. 시스템 WebKit을 쓰는 앱에서만 겪는 일이다.

## 터미널에 "안녕하세요"를 치면 "ㅇㄴㅎ세요"가 된다

xterm.js 6.0을 그대로 띄운 페이지를 Safari로 열고 "안녕하세요 반갑습니다"를 다섯 번 쳤더니 이렇게 들어갔다.

```
ㅇㄴㅎ요 ㅂㄱㄴ다
ㅇㄴㅎ세요 ㅂㄱㄴ
ㅇㄴㅎ세요 ㅂㄱ스ㄴ다
ㅇㄴㅎ세요 ㅂㄱ스ㄴ다
ㅇㄴㅎ세요 ㅂㄱㄴ
```

음절 대부분이 첫 자음만 남고, 어떤 음절이 온전히 남는지는 칠 때마다 달라진다. Tauri 앱 안의 WKWebView에서도 똑같고, 같은 페이지의 평범한 `<textarea>`에서는 멀쩡하게 입력된다.

## WebKit에서는 composition 이벤트가 오지 않는다

웹에서 한글처럼 조합해서 쓰는 글자는 보통 `compositionstart`, `compositionupdate`, `compositionend` 이벤트와 함께 들어온다. 에디터나 터미널 라이브러리는 이 이벤트를 보고 "지금은 조합 중이니 아직 보내지 말자"고 판단한다.

그런데 macOS 기본 두벌식으로 치면 WebKit에서는 이 이벤트가 하나도 오지 않는다. input 이벤트를 찍어 보면 이렇게 온다.

```
insertText             "ㅇ"
insertReplacementText  "아"     앞 글자를 바꿔 끼움
insertReplacementText  "안"
insertReplacementText  "안"     다음 음절로 넘어가며 확정
insertText             "ㄴ"     새 음절 시작
...
```

첫 자모는 `insertText`로 들어오고, 그다음 자모부터는 방금 들어간 글자를 바꿔 끼우는 `insertReplacementText`로 온다. WebKit 쪽에서는 macOS 한글 입력기가 원래 이렇게 동작하니 예상된 동작이라는 답이 달렸다([WebKit bug 274700](https://bugs.webkit.org/show_bug.cgi?id=274700)). Firefox는 이 교체 입력을 composition으로 바꿔서 처리하는데([Mozilla bug 1341960](https://bugzilla.mozilla.org/show_bug.cgi?id=1341960)), WebKit은 그대로 넘긴다.

xterm.js는 이 input 이벤트를 쓰지 않는다. `insertReplacementText`는 처음부터 보지 않고, 키를 누른 직후에 오는 `insertText`도 버린다. 대신 입력기가 처리하는 키(keyCode 229)가 눌리면 `setTimeout(0)` 뒤에 textarea 내용을 키를 누르기 전과 비교해서 보낸다(`CompositionHelper`의 `_handleAnyTextareaChanges`). 원래는 입력기가 켜진 채로 숫자나 문장 부호를 칠 때를 위한 예비 경로인데, composition 이벤트가 없으니 한글 자모가 전부 이 길로 나간다. 이 비교가 바꿔 끼운 글자를 제대로 따라가지 못해서, 음절의 첫 자모만 나가고 그 뒤에 바꿔 끼운 글자는 대부분 버려진다.

어떤 음절이 온전히 남는지는 타자 속도에 따라서도 달라졌다. "반갑습니다"를 천천히 치면 `ㅂㄱ스ㄴ다`, 빠르게 치면 `ㅂㄱㄴ다`가 됐다. 왜 속도에 따라 갈리는지까지는 확인하지 못했다.

## 터미널에서는 음절을 붙잡아 두었다가 보낸다

터미널은 글자를 한 번 보내면 그쪽 프로그램이 이미 받아 버린다. 백스페이스를 보내서 지우는 것도 프로그램마다 받는 방식이 달라서 믿을 수 없다. 그래서 조합 중인 음절은 보내지 않고 붙잡고 있다가, 음절이 끝났다고 확신할 수 있을 때 보낸다.

```ts
input(inputType: string, data: string) {
  if (inputType === 'insertText') {
    this.flush();          // 앞 음절은 이제 끝났으니 보낸다
    this.pending = data;   // 새 음절 시작
  } else if (inputType === 'insertReplacementText') {
    this.pending = data;   // 조합 중인 음절만 바꾼다
  }
}
```

이것만으로는 부족해서 몇 가지를 더 챙겼다.

- 이벤트는 capture 단계에서 가로채되 `stopPropagation`만 하고 `preventDefault`는 하지 않는다. 입력기가 textarea 안의 글자를 기준으로 교체하기 때문에 글자가 거기 남아 있어야 한다.
- 조합 중인 글자는 아직 PTY로 보내지 않았으니 터미널에는 안 찍힌다. 그래서 커서 위치에 밑줄 친 글자를 얹어 보여 주고, 커서가 움직이거나 출력이 들어올 때마다 위치를 다시 맞춘다. 안 그러면 에코가 늦게 올 때 앞 글자를 덮는다.
- 붙잡은 음절은 다음 음절의 `insertText`가 올 때, xterm이 Enter나 화살표, Ctrl 키 같은 걸 내보내기 직전, textarea나 창이 포커스를 잃을 때, 터미널을 마우스로 누를 때 보낸다.
- 클릭으로 음절을 보내도 입력기는 아직 조합 중인 줄 안다. 그대로 다음 자모를 치면 방금 보낸 글자를 바꿔 끼우려고 해서, textarea를 `blur()` 했다가 다시 `focus()` 해 입력기를 초기화한다.
- Enter로 보낸 직후에 같은 글자의 확정 교체가 한 번 더 올 수 있는데, 그대로 두면 같은 음절이 두 번 들어가서 무시한다.

이렇게 해서 "안녕하세요 반갑습니다"가 제대로 들어간다. 백스페이스로 자모를 지우는 것(갃에서 각, 가 순으로)은 입력기가 교체로 처리해 준다. 마지막 자모를 지울 때만 `deleteContentBackward`가 오는데, 아직 보내지 않은 글자라 xterm이 PTY에 DEL을 보내지 않도록 이것만 가로챈다.

xterm.js에도 같은 문제를 고치는 [PR #5704](https://github.com/xtermjs/xterm.js/pull/5704)가 열려 있다. 메인테이너가 WebKit 전용으로 composition을 흉내 내는 클래스로 분리해 달라고 한 상태라, 그 PR이 머지되면 내 보정은 걷어낼 생각이다.

## Monaco는 글자는 맞는데 줄이 흔들린다

나중에 파일 편집기로 Monaco를 넣었더니 이번엔 다른 증상이 나왔다. 한글을 치면 입력이 한 박자 늦는 느낌이 들고, 글자를 칠 때마다 줄이 위아래로 몇 픽셀씩 흔들렸다.

처음에는 xterm.js와 같은 문제인 줄 알았는데, Monaco 코드를 읽어 보니 글자 자체는 맞게 처리하고 있었다. Monaco는 숨긴 textarea의 내용을 매번 이전 상태와 비교해서, `insertReplacementText`를 "앞 글자 하나를 바꿔 끼우기"로 제대로 알아듣는다. composition 이벤트를 흉내 내서 넣어 주는 방법도 생각했지만, 그러면 Monaco가 조합 중 오버레이를 띄우는 경로를 타게 되고, 그 경로는 흔들림이 확인된 바로 그 경로(monaco-editor#4796)라 접었다.

흔들림은 숨긴 textarea의 스크롤에서 나온다. WebKit에는 EditContext API가 없어서 Monaco는 숨긴 textarea로 입력을 받는다. 기본 설정(`accessibilitySupport: 'auto'`)에서 Monaco는 스크린 리더를 위해 커서 앞뒤 글자를 넉넉히 이 textarea에 넣어 두고, 줄 높이에 맞춰 `scrollTop`을 직접 맞춘다. 그런데 WebKit은 글자가 들어올 때마다 커서가 보이도록 textarea를 스스로 스크롤하고, 그 값이 Monaco가 맞춘 값과 3px 어긋난다. Monaco가 되돌려 놓으면 다음 글자에서 또 어긋나고, textarea가 줄 위에 보이는 동안에는 이 밀고 당기기가 그대로 흔들림으로 보인다. 정확히 어떤 순간에 textarea가 보이게 되는지까지는 다 확인하지 못했지만, 아래 옵션 하나로 흔들림이 사라졌다.

```ts
monaco.editor.create(host, {
  // ...
  accessibilitySupport: 'off',
});
```

`'off'`면 textarea에 커서 앞 단어 정도만 들어가서 스크롤이 0으로 고정된다. Safari에서 중국어를 칠 때 줄이 위아래로 뛴다는 이슈([monaco-editor#4796](https://github.com/microsoft/monaco-editor/issues/4796))가 이미 있었고, Tauri 앱에서 같은 걸 겪은 사람이 거기에 이 옵션을 적어 두었다. 스크린 리더가 읽을 수 있던 커서 앞뒤 글자가 사라지는 대가가 있다. Monaco를 단독으로 쓰면 스크린 리더를 감지하지 못해 `'auto'`가 스크린 리더 최적화 모드로 바뀌는 일은 없으니, 잃는 건 그 글자 정도다.

vaquita의 실제 코드는 GitHub에 있다. 터미널 쪽은 [`hangul.ts`](https://github.com/zeikar/vaquita/blob/main/app/src/lib/hangul.ts)와 [`hangul-fix.ts`](https://github.com/zeikar/vaquita/blob/main/app/src/lib/hangul-fix.ts), 편집기 쪽은 [`TextEditor.svelte`](https://github.com/zeikar/vaquita/blob/main/app/src/lib/TextEditor.svelte)다.
