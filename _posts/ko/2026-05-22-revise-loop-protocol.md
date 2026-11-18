---
title: "Claude Code 에이전트 팀 리뷰 루프에서 겪은 메시지 race 다섯 가지"
subtitle: "7줄짜리 의사코드였던 hyperclaude의 리뷰 루프는 도그푸딩에서 깨질 때마다 규칙을 하나씩 얻어 300줄 넘는 프로토콜이 됐다."
date: 2026-05-22
unit: hyperclaude
last_modified_at: 2026-11-18
translations:
  en: /blog/revise-loop-protocol/
description: "hyperclaude의 plan-loop와 implement-loop에서 lead가 teammate 메시지를 잘못 받은 다섯 경우: plain-text 답장, stale 답장, idle 알림 등."
---

> **업데이트 (2026-08-18):** 이 프로토콜은 이제 거의 다 걷어냈다. 이 루프가 왜 그렇게 비싼지 측정하다가 업스트림 버그를 찾았다. Agent 툴에 `name`을 넘기면 플러그인 에이전트의 정의가 조용히 버려지는데, 같은 파라미터가 에이전트를 팀 멤버로 만들어 메일박스도 연다. 아래 race는 전부 그 메일박스에서 일어났다. `name`을 빼니 공유 프로토콜이 192줄에서 39줄이 됐다. 아래 실패는 전부 실제로 겪은 것이지만, 원인은 루프 설계가 아니라 그 파라미터에 있었다. → [Claude Code 플러그인 에이전트에 name을 넘기면 매 라운드 캐시가 깨지는 이유](/blog/ko/protocol-working-around-a-bug/)

[hyperclaude](/hyperclaude/)([코드](https://github.com/zeikar/hyperclaude))는 Claude가 만들고 Codex가 비평하는 분업 위에 세운 Claude Code 플러그인이다. 그중 `hyper-plan-loop`와 `hyper-implement-loop`는 태스크 하나를 받아 plan → review → revise(또는 implement → review → fix)를 알아서 돌리고, Codex가 Blocker나 Major를 더 내지 않거나 리뷰 횟수 상한에 닿으면 멈춘다. Claude 쪽 teammate 하나(plan-loop는 `planner`, implement-loop는 `fixer`)가 라운드 사이에 계속 살아 있고, 리뷰는 늘 Codex가 맡는다.

화이트보드에 그리면 7줄이다.

```
spawn teammate
loop:
  reply = teammate.produce()
  result = codex.review(reply)
  if result.clean: break
  send(teammate, result.findings)
teardown
```

이 글을 쓰는 지금 plan-loop의 SKILL.md와 공유 reference를 합치면 400줄이 넘고, 프로토콜 파일(공유 reference와 루프별 failure protocol)만 세도 300줄이 넘는다. 미리 설계한 분량은 거의 없다. 도그푸딩하다 걸린 버그 중에 프롬프트로는 못 막는 것들이 쌓였다. 여기서는 그중 다섯 개를 다룬다. 앞의 셋은 실제 실행이 멈추거나 엉뚱하게 흘러간 경우고, 뒤의 둘은 그 수정을 넣으면서 빠지기 쉬운 함정이다.

## 나이브한 루프는 줄 수보다 실패 모드가 많다

Claude Code의 실험 기능인 agent teams 런타임에는 아래 얘기 전부에 깔린 속성이 두 가지 있다.

첫째, 라운드 사이에 idle로 둔 teammate는 **프로세스와 컨텍스트가 그대로 살아 있다**. 이 루프들이 있는 이유가 이것이다. 라운드마다 planner를 새로 spawn하면 방금 쌓은 컨텍스트를 잃는다. 그래서 teammate는 살려 두고, 리뷰 횟수에 상한을 둔다.

둘째, lead는 **전달된 것**에만 반응한다. teammate의 메시지와 idle 알림이 새 turn으로 들어올 뿐, poll이나 wait 같은 프리미티브는 없다. lead가 들어온 걸 잘못 분류하면 루프는 멈추거나 스스로 꼬인다. "다시 확인해 보기"라는 선택지가 없다.

두 속성 모두 양날이다. 살아 있는 teammate는 쓸모 있는 컨텍스트와 함께 이전 라운드의 stale 메시지도 살려 둔다. 전달된 것에만 반응하니 깨어날 때마다 이유가 있지만, 잘못 라우팅된 전달은 갈 데가 없다. 아래 실패는 전부 이 두 속성이 겹치는 곳에서 나왔다.

## #1. plain-text 답장은 lead에게 안 보인다

planner의 초기 버전은 자기 턴을 이렇게 끝냈다.

```
WROTE: .hyperclaude/plans/20260517-0930-foo.md
```

자기 assistant 턴에 plain text로 출력하고 idle로 들어간다. lead는 이 `WROTE: …`를 읽고 다음으로 넘어가면 되는 줄 알았다.

아니었다. teammate가 idle로 들어가면 lead가 받는 건 payload 없는 알림 `{type: "idle_notification", ...}`이다. **teammate가 출력한 plain text는 그 안에 없다.** idle이 일어났다는 사실만 있고 본문은 없다. teammate가 출력한 건 teammate의 transcript에만 남는다. 트랜스크립트를 열어 보니 lead는 빈 idle 알림만 받고 corrective 왕복으로 넘어가 있었다.

수정은 구조로 했다. 답장은 반드시 `SendMessage`로 보낸다. planner의 spawn prompt에 "먼저 `SendMessage({to: 'team-lead', message: 'WROTE: <id> <path>'})`를 호출하고, 그다음에 idle로 들어가라"를 필수 항목으로 넣었다. plain text를 출력해도 되지만 무시된다. contract는 `SendMessage` 호출이다. 사람이 읽는 출력이 아니라 기계가 받는 형식을 contract로 삼는다는 점은 [문서 파이프라인 글](/blog/ko/three-agents-one-document/)의 Output Contract와 같은 발상이다.

이걸로 idle 처리까지 해결되지는 않았다. "답장은 SendMessage로"와 "idle은 깨우는 신호일 뿐"은 서로 다른 문제고 규칙도 따로 필요하다. 아래는 전부 idle 쪽 얘기다.

## #2. Codex 리뷰가 도는 동안 메일박스에 뭐든 들어온다

`plan-review`는 Codex 서브프로세스로 돌고 몇 분씩 걸린다. Bash 타임아웃을 10분으로 잡아 둘 정도다. 그동안 lead는 Bash 호출 하나에 묶여 있다.

teammate는 idle이지만 메시지 런타임은 쉬지 않는다. 이 사이에 두 종류가 쌓였다. 이전 라운드 답장의 재전송, 그리고 늦게 도착하는 이전 라운드의 idle 알림이다. idle 쪽은 #3에서 다룬다.

재전송부터 말하면, 맨 처음 planner는 plan 본문을 메시지로 돌려보냈고, Codex 리뷰를 기다리는 동안 본문을 다시 보내거나 `RESEND:`를 붙여 재전송하거나 답을 재촉했다. 그래서 planner가 plan 파일을 직접 쓰고 `WROTE:` 한 줄만 보내게 바꾸고, spawn prompt에 "다시 보내지 말고 기다려라"를 넣었다. 프롬프트만으로는 다 막히지 않아서 lead 쪽 규칙도 붙였다. 청하지 않은 메시지가 오면 내용은 무시하고 "연락할 때까지 idle로 있어라" 한 번만 보낸다. 같은 게 한 번 더 오면 teardown이다.

한 줄짜리 답장도 문제가 남았다. plan은 라운드마다 같은 경로에 덮어쓴다(Codex 리뷰의 `--resume`이 경로를 키로 쓴다). 그러니 이전 라운드의 `WROTE: <path>`와 이번 라운드의 답장이 바이트까지 똑같다. 정적 랜딩 페이지 plan을 돌리던 실행에서 lead는 revise 요청을 보낸 뒤 들어온 stale `WROTE:`를 이번 라운드 답장으로 받았고, 이번 revise가 반영되지 않은 plan 파일로 다음 단계에 넘어갔다.

라운드 N의 전달이 라운드 N+1 자리에 나타나는 버그다. 둘을 구별할 장치가 없으면 루프는 stale 답장을 성공으로 받거나, 반대로 눈에 보이는 게 전부 stale이라서 "답장 없음" corrective를 계속 보낸다.

수정은 **request-id 카운터**다. lead가 보내는 모든 요청에 단조 증가하는 정수를 붙이고, teammate는 `WROTE: <id> <path>`에 그 숫자를 그대로 돌려준다. id는 lead만 발급한다. 들어온 답장의 id가 기다리는 id보다 작으면 stale이니 내용은 무시하고 진짜 답장을 계속 기다린다. 기다리는 id보다 큰 id는 나올 수 없으니 프로토콜 위반으로 보고 teardown 후 멈춘다.

## #3. 한 라운드씩 밀리는 idle 알림

id 카운터는 `WROTE:` 답장을 가려낸다. idle 알림은 id가 없어서 가려내지 못한다.

카운터를 넣은 버전을 다른 프로젝트에 돌려 보다가 이 race가 터졌다. 시각은 UTC다.

1. planner가 `WROTE: 1`을 보내고 21:53:18에 idle로 들어간다. 답장이 먼저 전달되고 idle 알림은 큐에 남는다.
2. lead가 답장을 받고 Codex 리뷰를 3분 반 돌린다.
3. lead가 21:57:03에 revise 요청(id 2)을 보낸다.
4. 3초 뒤, 1에서 큐에 남아 있던 idle 알림이 lead의 다음 turn으로 들어온다.
5. lead는 id 2의 답장을 기다리는데 idle이 보인다. lead도 이 idle이 이상하다는 건 알아챘지만, 당시 규칙은 "id 없는 전달이 오면 corrective"였다. 규칙대로 id 3을 발급해 corrective를 보낸다.
6. planner는 아직 id 2 작업 중이다. 끝내고 `WROTE: 2`를 보내지만 lead는 이제 3을 기다리니 stale로 버린다. 그 뒤 들어온 idle에 또 corrective가 나간다.

planner의 답장은 매번 lead가 기다리는 id보다 하나씩 뒤처졌다. 이 실행은 revise를 하나도 반영하지 못한 채 id 5에서 teardown으로 끝났다.

수정은 **타임스탬프 가드**다. lead는 `SendMessage` 직전마다 Bash로 `date -u +%FT%TZ`를 실행해 `solicit_sent_at`에 저장한다. `idle_notification`에는 teammate가 실제로 idle로 들어간 시각인 `idle.timestamp`가 들어 있다. `idle.timestamp < solicit_sent_at`이면 이 idle은 지금 요청에 대한 반응일 수가 없으니 조용히 무시하고 계속 기다린다. 기준은 teammate의 답장이 아니라 lead가 보낸 시각이다.

## #4. turn 시작 시각은 send 직전 `date -u`를 대신할 수 없다

여기서 솔깃한 지름길은 lead의 현재 turn이 시작된 시각을 `solicit_sent_at`으로 쓰는 것이다. 이미 컨텍스트에 있으니 Bash 호출 하나를 아낄 수 있고, 거의 맞는다.

거의 맞는 건 맞는 게 아니다. lead의 turn 하나는 이렇게 흘러갈 수 있다.

1. 시각 `T`에 시작한다.
2. Codex 리뷰 결과를 받는 데 5분을 쓴다.
3. 새 id를 발급한다.
4. `T + 5분`에 다음 요청을 보낸다.

이전 라운드의 idle 알림이 `idle.timestamp = T + 2분`이라면 turn 시작과 실제 전송 사이에 딱 끼인다. `T`와 비교하면 lead는 "내 turn이 시작된 뒤에 들어간 idle이니 새 요청에 대한 반응"이라고 판단한다. 하지만 그 요청의 `SendMessage`는 아직 일어나지도 않았다. #3의 race가 그대로 돌아온다.

그래서 가드를 넣을 때부터 `date -u`는 **`SendMessage` 직전의 마지막 tool call**이어야 한다고 못 박았다. 공유 reference와 두 루프의 SKILL.md에 *"assistant-turn start is NOT valid"*를 되풀이해 적었다. 모델이 Bash 호출 하나를 아끼려 드는 순간 가드가 무력해지기 때문이다.

## #5. `expected_request_id == null`로 phase를 합치는 함정

request-id 카운터를 넣으면 서로 얽히는 상태 변수가 둘 생긴다. lead가 기다리는 id인 `expected_request_id`(안 기다리면 `null`)와 boolean `awaiting_reply`다. 합치고 싶어진다. `expected_request_id == null`이면 곧 `awaiting_reply == false` 아닌가?

값으로는 같지만, 들어온 메시지를 분류하는 규칙은 다르다. phase가 둘이다.

**Phase 1** (`awaiting_reply == false`): lead는 아무것도 기다리지 않는다. 대개 Codex 리뷰를 돌리는 중이다. 이때 들어온 `WROTE:`는 stale이거나 중복이다. 비교 대상은 `expected_request_id`(지금 `null`)가 아니라 지금까지 발급한 마지막 id인 `request_id_counter`다. 그 이하면 조용히 무시하고, 그보다 크면 위반이다.

**Phase 2** (`awaiting_reply == true`): lead는 정확히 `expected_request_id`를 기다린다. 이제 `reqid < expected_request_id`는 stale(무시하고 계속 대기), `reqid == expected_request_id`는 진짜 답장 후보(accept 규칙 실행), `reqid > expected_request_id`는 불가능(teardown)이다.

두 phase를 비교식 하나로 합치면 Phase 1에서 `null`과 비교하게 되거나, 리뷰 중에 들어온 중복 답장을 새 답장과 같은 accept 로직에 넣게 된다. 그러면 null 검사를 어디에 두느냐에 따라 같은 중복이 위반으로도, 성공으로도 처리된다. 공유 reference의 anti-pattern 목록에 "Phase 1과 Phase 2를 비교식 하나로 합치기"가 따로 들어간 이유다.

## 두 루프가 나눠 쓰는 프로토콜

plan-loop에서 막은 race는 implement-loop에도 같은 모양으로 있었다. 그래서 이 글을 쓰기 직전에 공통 부분을 공유 reference `loop-protocol.md`로 뺐다. `§E`가 request-id state machine과 위의 상태 변수를, `§B`가 청하지 않은 메시지 처리를 맡는다. 루프별 `failure-protocol.md`는 거기에 각 루프의 값을 채운다. planner의 답장은 `WROTE: <id> <path>` 한 줄이고, fixer의 답장은 첫 줄이 `request-id: <id>`인 구조화된 findings 블록이다. accept 규칙과 답장을 받은 뒤의 검증(plan 파일 구조 검사, finding별 처리 결과 대조)도 루프마다 다르다.

*처음 이 글은 "persistent teammate + 오래 걸리는 리뷰어 조합은 프롬프트 규율만으로는 못 고치는 race를 만든다"는 결론으로 끝났다. [후속 글](/blog/ko/protocol-working-around-a-bug/)에서 밝혔듯 race가 일어난 메일박스는 Agent 툴의 `name` 파라미터가 만든 것이었고, 그걸 빼자 race도 같이 사라졌다. 2026년 11월에 그 결론과 섹션마다 붙어 있던 일반화를 지웠다.*
