---
title: "hook 없이 에이전트 상태 읽기"
subtitle: "Claude Code와 Codex는 이제 작업 중인지, 내 답을 기다리는지, 끝났는지를 OSC 7501이라는, 나온 지 3주도 안 된 이스케이프 시퀀스로 터미널에 알린다. 이걸 받아 읽는 데 hook은 필요 없다. 다만 두 에이전트가 이 프로토콜을 쓰는 방식이 다르고, 정작 어려운 건 턴이 언제 끝났는지 알아내는 일이었다."
date: 2026-10-25
unit: vaquita
translations:
  en: /blog/reading-agent-status-without-hooks/
description: "vaquita가 hook이나 설정 변경 없이 OSC 7501 상태 보고와 Codex의 OSC 9 알림만으로 Claude Code, Codex 세션의 상태(작업 중, 입력 대기, 완료)를 추적하는 방법과, 녹화로 찾아낸 예외 상황."
---

[vaquita](/projects/vaquita/)는 Claude Code와 Codex를 나란히 띄워 쓰는 작은 macOS 앱이다. 사이드바에는 세션마다 에이전트가 뭘 하는지 표시된다. 작업 중이면 스피너, 권한이나 답을 기다리면 ⚠, 턴이 끝나면 ✓가 뜨고, 에이전트가 나를 찾을 때는 데스크톱 알림이 온다.

보통은 hook으로 이런 상태를 받는다. 에이전트 설정에 이벤트마다 앱으로 보고하는 명령을 등록하고, 그걸 받을 프로세스를 따로 띄운다. 잘 되긴 하지만 에이전트 설정을 고쳐야 하고, 연결해 둔 에이전트만 잡힌다. 나는 vaquita가 이미 깔려 있는 `claude`와 `codex`를 그대로 실행하고, 그 설정에는 아무것도 쓰지 않길 바랐다. 화면을 읽는 방법도 있지만 깨지기 쉽다. 뒤에 나올 제안 글에 예가 있는데, 창 제목의 스피너 글자로 Claude Code 상태를 알아내는 도구가 감지 코드 파일을 석 달 동안 열 번 고쳤다고 한다.

알고 보니 에이전트가 막 스스로 상태를 말하기 시작한 참이었다.

## 갓 나온 상태 프로토콜

10월 6일 Mitchell Hashimoto가 [OSC 7501, Program Status Protocol](https://mitchellh.com/writing/program-status-osc7501)을 제안했다. 프로그램이 지금 어떤 상태인지 터미널에 써 보내는 이스케이프 시퀀스다. Claude Code는 며칠 뒤 [2.1.295](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)에서 지원을 넣었고, Codex에는 10월 9일에 머지됐다([#52725](https://github.com/openai/codex/pull/52725)). 나는 10월 21일에 vaquita를 시작했다.

보고는 `key=value` 쌍을 이어 붙인 형태다.

```
ESC ] 7501 ; state=blocked:kind=permission:app=claude-code:msg=<base64> ESC \
```

`state`는 `idle`, `working`, `done`, `blocked`, `error` 중 하나이고, 레코드를 지울 때는 `clear`를 쓴다. `blocked`에는 `kind`(`permission`, `question`, `auth`)가 붙고, `msg`는 base64로 인코딩한 한 줄 설명이다. `id`(예: `agent/2`)로 subagent 같은 하위 레코드를 가리킬 수도 있다. 터미널은 다른 이스케이프 시퀀스처럼 출력 스트림에서 이걸 읽어 낸다. 소켓도 설정도 필요 없고, SSH 너머에서도 된다.

다만 터미널이 이 프로토콜을 안다고 답해 줘야 한다. 프로그램이 `ESC ] 7501 ; ? ESC \`를 보내면 터미널은 지원하는 상태와 kind 목록으로 답한다. Claude Code는 시작할 때 한 번 묻고, 답이 없으면 보고를 아예 보내지 않는다. Codex는 묻지 않고 보낸다.

vaquita의 터미널은 WebKit 뷰 안의 xterm.js라서 이 질의에는 앱이 답한다. 이 말은 화면에 안 보이는 세션도 답해야 한다는 뜻이다. 세션마다 터미널을 따로 두어 안 보이는 동안에도 출력을 계속 파싱하고, 창에서는 WebKit의 백그라운드 스로틀링을 꺼 둔다. 끄지 않으면 어떻게 되는지 재 봤다. 1초마다 질의를 받아 답하는 시험 창을 최소화하자 기본 설정에서는 6번 답하고 멈췄다. 스로틀링을 끄면 6분 동안 한 번도 빠짐없이 답했고, 응답 시간 중앙값은 8ms였다.

## 만들기 전에 녹화부터

에이전트가 실제로 뭘 보내는지부터 녹화했다. 작은 Python 녹화 스크립트가 PTY에서 Claude Code나 Codex를 띄우고, vaquita처럼 터미널 질의에 답하면서 정해 둔 프롬프트를 입력하고, 상태 보고를 시각과 함께 전부 기록한다. 시나리오는 평범한 한 턴, 권한 요청, 질문, Esc로 취소, 종료였다.

첫 녹화에서는 Claude Code가 `blocked`를 보내지 않는다고 나왔다. 권한 창이 떠도 기록에는 아무것도 없었다. 그래서 처음 계획은 이걸 우회해 Claude의 별도 알림 채널(OSC 777)을 입력이 필요하다는 신호로 쓰는 것이었다. 그런데 이 알림은 프롬프트가 뜨고 6초나 지나서야 왔고, 문구도 권한 요청이든 질문이든 똑같았다.

틀린 건 녹화 스크립트였다. 이벤트를 기록하는 함수가 이벤트 종류를 `kind` 인자로 받고 있어서, `kind=` 필드가 붙은 보고는 전부 TypeError를 내고 버려졌다. Claude Code가 보내는 `blocked`가 전부 여기 걸렸다. 스크립트를 고치자 `blocked`가 제대로 찍혔다. `kind=permission`과 `approve Bash: touch probe.txt` 같은 메시지가 붙어서, 대화상자가 그려지기 26~32ms 전에 왔다. 설계는 오히려 단순해졌다. 입력이 필요한지는 OSC 7501만 보고 판단하고, OSC 777은 쓰지 않는다.

## "완료"는 이벤트 하나가 아니다

입력 대기는 쉬웠다. 두 에이전트 모두 프롬프트를 띄우기 전에 `blocked`를, 프롬프트가 닫히면 `idle`을 보낸다. 어려운 건 턴이 끝난 시점이다. 두 에이전트는 턴을 끝내는 방식이 서로 다르고, 끝났다는 신호를 딱 하나만 깔끔하게 보내 주지도 않는다.

![같은 한 단어 프롬프트를 보냈을 때의 두 타임라인. Claude Code는 0.5초에 working, 4.1초에 done, 6.7초에 요약이 담긴 두 번째 done을 보내고, vaquita는 이때 알린다. Codex는 0.8초에 working을 보내고, 2.5초에 응답이 담긴 OSC 9 알림과 idle을 한 번에 쓴다. vaquita는 1.5초 동안 조용한 걸 확인하고 4.0초에 알린다.](/assets/images/blog/agent-status-one-turn.webp)

Claude Code는 `done`을 두 번 보낸다. 한 단어로 답하라는 프롬프트에 4.1초에 `done`이 오고, 6.7초에 요약(`replied "pong" as requested`)이 담긴 두 번째 `done`이 왔다. 에이전트는 상태가 오락가락하기도 해서, `done` 다음에 다시 `working`이 올 수 있다. 그래서 ✓는 바로 띄우되 알림은 미룬다. 턴을 끝내는 `done`이 메시지가 있으면 1.5초, 없으면 3초 동안 바뀌지 않아야 알림을 보낸다. 요약이 따라올 시간을 주는 것이다. 두 번째 `done`은 메시지만 바꾼다.

Codex는 `done`을 아예 보내지 않는다. OSC 7501로 보내는 건 `idle`, `working`, `blocked`, `clear`가 전부다. 턴이 끝나면 `working`에서 `idle`로 바뀐다. Esc로 취소해도, 권한을 거절해도, 세션을 시작한 직후 잠깐 `working`이었다가 돌아올 때도 똑같이 `idle`이 온다. OSC 7501만으로는 끝난 턴과 취소한 턴을 구분할 수 없다.

Codex에는 채널이 하나 더 있다. 자체 터미널 알림인데, 설정 파일을 건드리지 않고 `-c` 옵션으로 그 세션에만 켤 수 있다. vaquita는 `codex`를 띄울 때 아래 옵션과 함께, 창 제목에 스레드 이름을 넣는 옵션을 하나 더 붙인다.

```
tui.notifications=["agent-turn-complete","approval-requested","plan-mode-prompt","async-question"]
tui.notification_method="osc9"
tui.notification_condition="always"
```

이렇게 하면 턴이 끝날 때 `OSC 9;pong`(마지막 응답)과 `idle`이 한 번에 오고, 취소나 거절에는 `idle`만 온다. OSC 9 바로 다음에 `idle`이 오면 완료로 보고, OSC 9 본문을 알림 내용으로 쓴다. OSC 9 다음에 `blocked`가 오면 본문이 `Approval requested: /bin/zsh -lc 'touch probe.txt'`처럼 무엇을 기다리는지 알려 주니, Codex의 `blocked`에 빠진 메시지를 이걸로 채운다. 그 밖의 `idle`에는 아무것도 표시하지 않는다.

이 규칙은 플랜 모드를 녹화하자마자 깨졌다. Codex가 "Implement this plan?"이라고 물을 때는 `blocked`가 아니라 `OSC 9;Plan mode prompt: Implement this plan?` 다음에 `idle`을 보낸다. 규칙대로라면 끝난 턴인데, 이 턴에는 완료 알림이 따로 오지도 않는다. `Plan mode prompt:`로 시작하는 OSC 9 다음의 `idle`은 입력 요청으로 보기로 했다. 이 팝업에서 Esc를 누르면 보고가 하나도 오지 않아서, 이 ⚠ 표시만은 세션을 열어 봐야 지워진다.

OSC 9를 알림에만 쓰는 것도 아니다. Windows Terminal과 ConEmu는 `9;4;1;50` 같은 진행률 표시 명령에도 OSC 9를 쓰고, Cargo나 systemd는 이걸 끊임없이 보낸다. 본문이 숫자와 세미콜론으로 시작하면 이런 명령으로 보고 무시한다.

## 강제 종료된 에이전트는 말이 없다

지금까지 본 규칙은 전부 에이전트가 보고를 해야 성립한다. SIGKILL로 죽은 에이전트는 아무것도 보내지 않는다. PTY의 자식 프로세스는 에이전트를 띄운 셸이라서 세션 프로세스도 끝나지 않는다. 다른 신호가 없으면 죽은 에이전트가 사이드바에서 계속 스피너를 돌린다.

그래서 vaquita는 에이전트가 보고를 보낸 뒤로 PTY의 포그라운드 프로세스 그룹을 1초마다 확인한다. 에이전트는 자기 프로세스 그룹으로 포그라운드에서 도는데, 셸이 터미널을 되찾았다면 에이전트는 사라진 것이다. 프로세스 그룹이 살아 있는지만 봐서는 부족했다. Claude Code가 띄우는 `caffeinate`가 Claude가 죽은 뒤에도 같은 그룹에 몇 분씩 남아 있을 수 있어서다. 에이전트가 사라지면 남아 있던 `working`이나 `blocked` 표시를 지우고, 에이전트가 켜 둔 터미널 모드도 되돌린다. 터미널 모드를 되돌리는 게 생각보다 중요하다. 마우스 추적이 켜진 채로 남으면 터미널 위에서 마우스를 움직일 때마다 셸에 이스케이프 시퀀스가 입력된다.

## 이걸로 안 되는 것

- 셸에서 `codex`를 직접 칠 때. `-c` 옵션은 vaquita가 띄우는 세션에만 붙으니, 직접 친 `codex`는 OSC 9를 보내지 않고 끝난 턴과 취소를 구분할 수 없다.
- tmux. OSC 7501은 아마 tmux를 통과하지 못할 텐데, 시험해 보진 않았다. vaquita는 세션을 tmux 안에서 돌리지 않는다.
- 버전. 녹화는 Claude Code 2.1.308, Codex 0.163.0으로 했다. 두 구현 모두 나온 지 2주쯤 됐고, Claude의 두 번째 `done` 같은 세부 동작은 바뀔 수 있다.
- 상태 말고 다른 정보. OSC 7501은 에이전트가 뭘 하고 있는지만 알려 주고, 무슨 요청을 받았는지는 알려 주지 않는다. 프롬프트 내용이나, 대화를 이어 갈 때 쓰는 대화 id까지 알아야 한다면 여전히 hook이 가장 직접적인 방법이다. vaquita는 대화 id를 에이전트가 이미 남겨 두는 파일에서 얻는데, 이건 다른 글에서 다룬다.

사이드바에 필요한 정보는 에이전트가 이미 말하고 있었다. vaquita가 따로 하는 일은 질의 하나에 답하고 `codex`에 옵션 몇 개를 붙이는 것뿐이다. 나머지는 어차피 화면에 그리던 출력에서 읽는다.

vaquita는 아직 0.1 버전이고 Apple Silicon Mac에서만 돌아간다. [최신 릴리스](https://github.com/zeikar/vaquita/releases/latest)에서 받을 수 있다. 나도 매일 쓰면서 고쳐 나가는 중이고, 버그 제보는 [이슈](https://github.com/zeikar/vaquita/issues)로 받고 있다.
