---
title: "Codex가 코드 리뷰 중에 서브에이전트를 띄운 이유"
subtitle: "읽기만 하던 Codex 리뷰가 몰래 자기 자신을 포크하고 있었고, 포크마다 대화 전체가 다시 과금됐다. 막으려고 넣은 설정 플래그는 오류 없이 통과했지만 아무것도 막지 못했다. 원인은 Claude Code와 같이 쓰던 규칙 파일의 한 섹션이었다."
date: 2026-11-14
unit: hyperclaude
translations:
  en: /blog/codex-sub-agent-spawns/
description: "같이 쓰던 AGENTS.md가 위임을 요청하는 바람에 Codex 리뷰 세션이 서브에이전트를 포크해 띄웠다. Codex 세션 로그로 잰 포크 비용과 features.multi_agent=false가 듣지 않은 이유, 원인을 고친 방법을 정리했다."
---

[hyperclaude](/projects/hyperclaude/)는 코딩 작업을 두 에이전트에게 나눠 맡긴다. Claude Code가 계획하고 코드를 쓰고, Codex는 읽기 전용으로 리뷰한다. Codex 호출은 전부 브리지 스크립트 하나를 거치고, 리뷰 결과는 Codex 토큰 사용량을 front matter에 적은 마크다운 파일로 남는다.

9월에 [Iki](/projects/iki/) 리뷰가 유난히 비싸게 느껴졌다. Iki에는 큰 파일이 몇 개 있어서 리뷰가 길어지는 건 이상하지 않았다. 그런데 리뷰 파일만으로는 정상인지 알 수 없었다. 거기 적힌 토큰이 전부가 아니었다.

## 토큰이 어디로 갔나

브리지는 자기가 시작한 세션만 기록한다. Codex 쪽은 모든 세션을 `~/.codex/sessions/`에 남기고, 다른 세션이 띄운 세션에는 부모가 누군지 적어 둔다. 9월 1일부터 20일까지의 기록을 프로젝트별로 세어 봤다.

| 프로젝트 | 세션 | 포크된 자식 | 입력 토큰 |
|---|---:|---:|---:|
| Iki | 19 | **21** | 48.2M + **포크 29.6M** |
| Charivo | 23 | 0 | 61.2M |
| hyperclaude | 10 | 0 | 13.9M |

Iki에서는 입력 토큰의 3분의 1 이상이 포크된 자식에서 나갔다. 가장 비싼 리뷰는 브리지 기록으로 12.73M이었는데, 자식 셋(`/root/fresh_review`, `/root/fix_round_review`, `/root/fit_fix_review`)이 10.8M을 더 썼다. 실제로는 23.5M을 썼고 리뷰 파일에는 그중 46%가 빠져 있었다.

Codex는 자식을 `fork_turns: "all"`로 띄웠다. 이러면 부모가 지금까지 나눈 대화를 자식이 통째로 넘겨받는다. 포크가 하나 뜰 때마다 리뷰가 이미 읽은 내용 값을 처음부터 다시 내는 셈이다.

Iki의 자식 21개 중 2개는 대화형 Codex 세션에서 나왔고, 나머지 19개는 hyperclaude 리뷰에서 나왔다. Iki만의 일도 아니었다. 같은 기간 다른 레포 세 곳에서도 리뷰 세션 10개가 포크했다. Iki는 그 수가 가장 많았고, 가장 비싼 리뷰도 거기서 나왔을 뿐이다.

## 서브에이전트를 요청한 문장

Codex가 아무 때나 서브에이전트를 띄우지는 않는다. 기본 지시문에 이렇게 적혀 있다.

> Do not spawn sub-agents unless the user or applicable AGENTS.md/skill instructions explicitly ask for sub-agents, delegation, or parallel agent work.

그러니 어딘가에서 명시적으로 요청하고 있었다는 얘기다. Codex는 세션마다 전역 `~/.codex/AGENTS.md`를 읽는데, 내 것은 Claude Code의 `CLAUDE.md`를 가리키는 심볼릭 링크였다. 두 에이전트가 같은 작업 규칙을 따르게 하려고 묶어 둔 것이다. 그 파일에는 Claude가 언제 서브에이전트에 일을 넘길지 정한 "Delegate What Pays" 섹션이 있고, 거기에 "이미 아는 맥락이 필요하면 fork하라"는 문장도 있다. Claude Code의 Agent 도구를 생각하고 쓴 문장인데, Codex는 이걸 자기 지시문이 말하는 바로 그 명시적 요청으로 읽었다.

처음엔 파일은 같이 쓰되 리뷰할 때만 빼려고 했다. Codex에는 그럴 방법이 없었다. `-c project_doc_max_bytes=0`은 프로젝트의 `AGENTS.md`만 빼고 전역 파일은 남긴다. `--ignore-user-config`는 `config.toml`은 건너뛰어도 전역 파일은 여전히 넣는다. `CODEX_HOME`을 바꾸면 로그인 정보도 같이 바뀌고, 이어서 돌리는 리뷰가 찾는 세션 저장소도 옮겨 간다.

## 오류 없이 통과하고 아무것도 안 한 플래그

끄는 설정을 찾아봤다. Codex에는 `features.multi_agent` 플래그가 있고, `codex -c features.multi_agent=false doctor`도 군말 없이 받아 줬다. v1.17.1에서 이 플래그를 모든 Codex 호출에 붙였다.

얼마 뒤 이 블로그 레포를 리뷰하던 세션이 또 포크했다. 브리지가 기록한 532k 말고도 `/root/review_print`라는 자식이 289k를 썼다. 그제야 제대로 테스트해 봤다. 서브에이전트를 대놓고 요청하는 프롬프트로 설정마다 `codex exec`를 돌리고 세션 로그를 확인했다.

| 설정 | 서브에이전트를 띄웠나 |
|---|---|
| `features.multi_agent=false` | 띄움. 모델에 간 프롬프트도 플래그가 없을 때와 한 글자도 다르지 않았다 |
| `features.multi_agent_v2=false` | 띄움 |
| `agents.max_depth=0`, `agents.max_threads=1` | 띄움 |
| 혼자 작업하라는 developer 지시 | 2번 중 2번 띄움 |
| `multi_agent_version`을 지운 모델 카탈로그 | **안 띄움**, 2번 중 2번 |

협업 도구는 기능 플래그가 아니라 Codex 모델 카탈로그에 모델마다 붙은 필드에서 나오고, 스레드를 만들 때 한 번 정해진다. 도구를 가진 채 시작한 스레드는 카탈로그를 고친 뒤에 이어서 돌려도 도구가 그대로 있다. 카탈로그를 고치면 듣기는 한다. 하지만 실행할 때마다 카탈로그를 확인하고 고치기 전에 시작한 스레드는 따로 막아야 하는 데다, Codex 업데이트로 이름이 바뀌어도 오류 하나 안 나는 내부 필드에 기대야 한다. 그래서 이 방법은 접고 v1.17.2에서 플래그를 뺐다. 브리지 코드는 v1.17.1 이전과 똑같아졌다.

v1.17.1 때는 정작 중요한 확인을 건너뛰었다. Codex가 설정을 받아들이는지만 봤지, Codex의 행동이 바뀌었는지는 보지 않았다.

## 원인을 고쳤다

포크를 부른 건 하나였고, hyperclaude 밖에 있었다. 9월 22일에 `~/.codex/AGENTS.md`를 심볼릭 링크에서 별도 파일로 바꿨다. 공유하는 작업 규칙에서 위임 섹션만 뺀 파일이다. 같은 날 참조 방향도 뒤집었다. 이제 `CLAUDE.md`가 `AGENTS.md`를 import하고 거기에 위임 섹션을 덧붙인다. Claude는 전부 읽고, Codex는 그 섹션을 아예 보지 못한다. 이 설정은 내 [dotfiles](/projects/dotfiles/)에 있다.

그 뒤로 이 컴퓨터에서 `codex exec` 세션이 1,000번 넘게 돌았고 hyperclaude 리뷰도 전부 그 안에 들어 있다. `spawn_agent` 호출은 한 번도 없었다. 서브에이전트가 뜬 건 대화형 Codex 세션에서뿐이었다.

## 다음엔 먼저 확인할 것

비용은 에이전트 자신의 로그로 세야 했다. 브리지 기록은 빠진 게 없어 보였지만 자기가 띄운 세션만 담고 있었다. 자식 세션도, 그 부모가 누군지도 처음부터 Codex 세션 로그에 다 있었다.

설정은 받아 줬다고 적용된 게 아니었다. 그 설정이 막아야 할 일을 직접 시켜 보고 그래도 일어나는지 봐야 한다.

규칙 파일을 같이 쓰면 에이전트마다 자기 식으로 읽는다. 같은 "위임"이 Claude에게는 도구 하나였고, Codex에게는 훨씬 비싼 다른 도구였다. 규칙 파일을 같이 쓰기로 한 건 지금도 잘했다고 보지만, 특정 도구를 부르는 부분은 그 도구를 가진 에이전트 쪽에만 두기로 했다.
