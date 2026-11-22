---
title: "터미널에 찍힌 경로를 눌러서 열기 (Claude Code 출력)"
subtitle: "Claude Code가 찍는 경로는 색으로 칠해지고, 여러 줄로 접히고, 셸 변수나 파일 이름만으로 나오기도 한다. 화면 글자만 보고 추측한 다음 디스크로 확인하고, 애매하면 링크하지 않는 쪽으로 정리했다."
date: 2026-11-22
unit: vaquita
translations:
  en: /blog/terminal-path-links/
description: "xterm.js 터미널에서 Claude Code가 찍은 경로를 ⌘+클릭으로 여는 법: 색 경계, 접힌 줄 잇기, 디스크 확인, 같은 명령의 셸 변수, 레포에서 하나뿐인 파일 이름."
---

요즘 [vaquita](/projects/vaquita/)라는 macOS 앱을 만들고 있다. Claude Code나 Codex 같은 코딩 에이전트를 여러 개 띄워 두고 쓰는 앱이다. 에이전트는 일하면서 "`app/src/lib/term-view.ts`를 고쳤다" 같은 말을 계속 찍는데, 그 경로를 ⌘+클릭하면 앱 안의 탭으로 바로 열리게 하고 싶었다.

정규식 하나면 될 줄 알았는데, 해 보니 터미널에는 글자만 남는다는 게 문제였다. Claude Code가 어디까지를 경로로 썼는지는 화면에 남지 않는다.

## 화면만 보고 경로 찾기

Claude Code는 백틱으로 감싼 코드를 다른 색으로 칠한다. 그래서 `~/.zshrc를 만듭니다`처럼 한글 조사가 경로에 바로 붙어 있어도, 색이 바뀌는 자리에서 끊으면 경로만 남는다. 조사를 하나하나 잘라 내는 방법도 써 봤는데 지저분해서 뺐다.

긴 경로는 Claude Code가 직접 줄을 바꾸고 다음 줄을 들여 쓴다. 터미널 입장에서는 그냥 서로 다른 두 줄이다. 윗줄이 오른쪽 끝까지 차 있고 아랫줄이 들여쓰기로 시작하면 둘을 이어 붙여 본다.

## 추측한 다음 디스크에 물어보기

여기까지는 화면 모양만 보고 하는 추측이라 틀릴 때가 있다. 예전에는 일단 밑줄을 긋고, 눌렀는데 파일이 없으면 상태 줄에 알렸다. 디스크를 미리 확인하면 무거울 것 같아서 미뤄 둔 건데, `"$S/battle_b_frames.png"` 같은 글자에 밑줄이 그어지고 눌러도 안 열리는 일이 자꾸 생겨서 결국 디스크 확인을 넣었다.

생각보다 가볍다. 파일 내용은 읽지 않고 있는지만(stat), 그것도 마우스를 올린 줄만 한 번 묻는다. 없다는 답은 금방 잊는다. 에이전트가 방금 만든 파일도 바로 열려야 해서다. 답이 늦으면 예전처럼 그냥 밑줄을 긋고, 네트워크 드라이브가 멈춰도 앱은 멈추지 않게 했다.

디스크 확인이 생기니 더 과감한 추측도 할 수 있게 됐다. 틀려도 디스크가 걸러 준다.

## 셸 변수

Claude Code가 이런 명령을 돌릴 때가 있다.

```
B=/tmp/example/scratchpad && S=$B/party && ls "$S/a.png"
```

`$S/a.png`를 누르면 `/tmp/example/scratchpad/party/a.png`가 열리면 좋겠다. 같은 명령 안에서 `S=`을 찾아 값을 넣고, 그 값에 들어 있는 `$B`도 같은 식으로 푼다.

명령이 어디서 시작하는지는 화면에 따로 표시가 없다. Claude Code는 긴 명령도 단어 단위로 줄을 바꾸니까, 윗줄 끝에 아랫줄 첫 단어가 들어갈 자리가 남아 있었다면 그건 이어지는 줄이 아니라 다른 줄이다. 이걸로 명령의 범위를 정한다.

처음엔 셸 문법을 좀 더 흉내 내려고 했다. 작은따옴표 안의 `$`는 그대로 두고, 따옴표 안의 `S=`는 무시하고, `$(...)` 안의 따옴표도 따라가는 식으로. 그런데 리뷰를 돌릴 때마다 빠뜨린 경우가 또 나왔다. `T="$(printf '%s' '"')"` 같은 한 줄이면 따옴표 추적이 꼬인다. 디스크에 있는 파일이라고 해서 명령이 뜻한 파일이라는 보장은 없으니, 따옴표를 잘못 읽으면 엉뚱한 파일이 열린다.

지금은 같은 명령에 `이름=`이 딱 한 번 있고, `$(`나 백틱이나 작은따옴표가 하나도 없을 때만 푼다. 조금이라도 애매하면 안 한다. 화면 글자를 셸에 넘겨서 풀어 보는 방법도 떠올렸지만, 터미널 출력은 믿을 수 없는 입력이라 `S=$(rm -rf ~)` 한 줄이면 사고가 난다.

다만 요즘 Claude Code는 끝난 Bash 명령을 "Ran 1 shell command" 한 줄로 접어 버려서, 이 기능은 ⌃O로 펼쳤을 때나 쓸 일이 있다.

## 파일 이름만 쓴 경우

에이전트는 설명에서 `path-link-provider.ts`처럼 이름만 쓰는 일이 많다. 세션을 시작한 폴더에서만 찾으면 레포 맨 위 파일밖에 못 잡는다. 그래서 `git ls-files`로 레포의 파일 목록을 읽어 두고, 그 이름의 파일이 딱 하나일 때만 링크를 건다. `index.ts`처럼 여러 개면 걸지 않는다. 목록은 처음 마우스를 올렸을 때 읽고, git이 오래 걸리면 포기한다.

마지막으로 `a.ts:40:5`처럼 줄 번호와 열이 붙어 있으면 편집기에서 그 자리로 간다.

코드는 GitHub에 있다. 경로를 찾는 쪽은 [`file-links.ts`](https://github.com/zeikar/vaquita/blob/main/app/src/lib/file-links.ts)와 [`path-link-provider.ts`](https://github.com/zeikar/vaquita/blob/main/app/src/lib/path-link-provider.ts), 디스크 확인은 [`path-exists.ts`](https://github.com/zeikar/vaquita/blob/main/app/src/lib/path-exists.ts), 파일 이름 찾기는 [`names.rs`](https://github.com/zeikar/vaquita/blob/main/app/src-tauri/src/names.rs)다. 모두 0.1.31에 들어갔고 [최신 릴리스](https://github.com/zeikar/vaquita/releases/latest)에서 받을 수 있다. 버그 제보는 [이슈](https://github.com/zeikar/vaquita/issues)로 받고 있다.
