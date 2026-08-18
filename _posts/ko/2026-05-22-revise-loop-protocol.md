---
title: "내 agent-team 리바이즈 루프가 300줄짜리 프로토콜을 갖게 된 이유"
subtitle: "의사코드 20줄을 state machine으로 자라게 만든 5가지 도그푸드 실패 모드 — hyperclaude의 plan-loop과 implement-loop 이야기."
date: 2026-05-22
translations:
  en: /blog/revise-loop-protocol/
description: "hyperclaude의 persistent-teammate 리바이즈 루프가 왜 긴 cross-loop 프로토콜을 갖게 됐는가 — request-id 카운터, solicit_sent_at 타임스탬프, 그리고 오후 하나를 통째로 잡아먹은 1-round-lag race."
---

> **업데이트 (2026-08-18):** 이 프로토콜은 이제 대부분 없다. 이 루프가 왜 그렇게 비싼지 측정하다가 업스트림 버그를 찾았다. Agent 툴 파라미터 하나가 플러그인 에이전트의 정의를 조용히 폐기하고 있었고, 아래 race들이 살던 메일박스가 바로 거기서 생긴 것이었다. 그걸 없애니 공유 프로토콜이 192줄에서 39줄이 됐다. 아래 실패들은 실재했지만, 마지막 결론은 아니었다. → [내 300줄짜리 에이전트 프로토콜은 파라미터 하나를 우회하고 있었다](/blog/ko/protocol-working-around-a-bug/)

[hyperclaude](/hyperclaude/) ([코드](https://github.com/zeikar/hyperclaude))의 autonomous revise loop 이야기다. Claude는 만들고 Codex는 비평한다는 분업 위에 세운 Claude Code 플러그인이고, 그중 두 스킬 — `hyper-plan-loop`, `hyper-implement-loop` — 가 태스크 하나를 받아서 plan → review → revise (또는 implement → review → fix)를 자기들끼리 돌린다. Codex가 더 이상 블로커를 안 내거나 hard cap에 닿을 때까지. Claude 쪽 teammate 하나는 라운드 사이에 계속 살아 있고, Codex는 계속 리뷰어다.

화이트보드에 그리면 20줄짜리다:

```
spawn teammate
loop:
  reply = teammate.produce()
  result = codex.review(reply)
  if result.clean: break
  send(teammate, result.findings)
teardown
```

실제 SKILL.md + 공유 reference는 400줄을 넘는다. 그 분량은 거의 다 미리 설계한 게 아니라, 도그푸딩하다 발견한 버그 중에 prompt만으로는 못 막는 것들 때문에 자라났다. 이 글은 그중 다섯 개를, 대체로 나를 물어뜯은 순서대로 풀어본다.

## 나이브한 루프는 줄 수보다 실패 모드가 더 많다

Claude Code의 experimental agent-teams 런타임에서 아래 모든 얘기에 깔린 두 가지 속성:

라운드 사이에 idle 상태로 둔 teammate는 **프로세스와 전체 컨텍스트가 살아 있다**. 이 루프들이 존재하는 이유 자체가 이거다 — 매 라운드마다 fresh planner를 새로 spawn하면 planner가 막 쌓은 컨텍스트를 잃는다. Persistent teammate, bounded review loop.

Lead는 **delivery**에만 반응한다 — teammate의 메시지, idle notification, bridge 결과. Poll/wait 프리미티브가 없다. Lead가 delivery를 잘못 분류하면 루프는 멈추거나 자가당착에 빠진다. "다시 확인해 봐" 같은 옵션이 없다.

두 속성 모두 양날의 칼이다. Persistence가 라운드 간 컨텍스트를 살리는 동시에, 이전 라운드의 stale 메시지도 살린다. Delivery-only 모델 덕분에 wake 하나하나가 의미를 갖지만, 잘못 라우팅된 wake는 갈 곳이 없다. 아래 모든 실패 모드가 이 교차점에 있다.

## #1 — plain-text 답장은 보이지 않는다

Planner 초기 버전은 자기 턴을 이렇게 끝냈다:

```
WROTE: .hyperclaude/plans/20260522-1430-foo.md
```

자기 assistant 턴에 plain text로 출력하고 idle. Lead는 그 `WROTE: …`를 읽고 진행하면 된다. 쉽다.

틀렸다. Teammate가 idle로 들어가면 lead는 payload 없는 wake를 받는다: `{type: "idle_notification", ...}`. **Teammate의 plain text는 그 안에 들어 있지 않다.** Idle이 발생했다는 사실만 들어 있고, body는 없다. Teammate가 자기 transcript에 출력한 건 teammate의 transcript에 남고, lead의 mailbox에는 안 보인다.

수정은 구조적이다. 답장은 반드시 `SendMessage`로 보내야 한다. Planner의 spawn prompt는 이제 길게 적혀 있다 — "먼저 `SendMessage({to: 'team-lead', message: 'WROTE: <id> <path>'})`를 호출한 *다음에* idle로 들어가라." Plain assistant text는 허용되지만 무시된다. `SendMessage` 호출이 contract다.

이것만으로는 idle 처리가 멀쩡해지지 않는다. "답장은 SendMessage로", "idle은 wake signal"은 독립된 패턴이고 각자 자기 규칙이 필요하다. #1 이후는 전부 idle 쪽 얘기다.

## #2 — Codex 리뷰가 5분 도는 동안엔 mailbox에 뭐든지 들어올 수 있다

`plan-review`는 fresh `codex exec` 서브프로세스에서 돌고, 평범한 plan에서도 5~10분 걸린다. 그 시간 동안 lead는 Bash 호출 하나에 블로킹된다.

그 윈도우 동안 teammate는 idle이지만, 메시지 런타임은 idle이 아니다. 두 종류의 쓰레기가 들어왔다:

**이전 라운드 답장의 재전송**. 원인은 다양했다 — `RESEND:` 같은 nag 패턴이 spawn prompt에 슬쩍 끼어든 적도 있고, 직전 corrective 때 idle에서 깨어난 teammate가 옛 답장을 다시 보낸 적도 있다. 결과는 똑같다. Codex에서 돌아온 lead의 mailbox에 `WROTE: …`가 와 있는데, 방금 끝낸 라운드의 답장처럼 *보이지만* 실제로는 두 라운드 전의 답장이다.

**이전 라운드의 `idle_notification`이 늦게 도착**. Teammate가 답장을 보내고 idle로 들어갔다. Idle wake가 큐잉됐다. Lead는 Codex로 5분을 보냈다. Lead가 재개해서 *그다음* 솔리시테이션을 보냈더니, 큐잉돼 있던 그 idle이 솔리시테이션 *이후*에 도착했다. 마치 새 솔리시테이션에 대한 응답인 것처럼 — 그럴 수가 없는데도.

같은 버그 패밀리다. 라운드 N의 delivery가 라운드 N+1 자리에 나타나는 거. 둘을 구별할 장치가 없으면, 루프는 쓰레기를 success로 받거나 — 더 나쁘게는 — 보이는 delivery가 stale뿐이라서 "답장 없음" corrective를 escalate한다.

첫 번째 종류의 수정은 **request-id 카운터**다. Lead가 보내는 모든 솔리시테이션에 monotonic increasing integer를 붙이고, teammate는 `WROTE: <id> <path>`에 그 숫자를 그대로 echo한다. ID 발급은 lead 단독이다. 들어온 답장의 id가 기다리는 id보다 작으면 정의상 stale이다 — 내용 무시, 진짜 답장 계속 기다림. 기대값보다 큰 id는 lead 단독 발급이라 불가능하다 — 프로토콜 위반이니 teardown 후 stop.

카운터는 integer 하나다. 이게 막는 패턴 — "긴 블로킹 단계 동안 이전 라운드의 delivery가 현재 라운드와 race할 수 있다" — 은 이 루프 너머에서도 유효하다.

## #3 — `idle.timestamp` vs. `solicit_sent_at`, 1-round-lag race

ID 카운터는 `WROTE:` 답장을 처리한다. Idle notification은 id를 안 들고 다니니까 못 처리한다.

도그푸딩 중에 이 race가 반복해서 떴다:

1. 라운드 N: teammate가 답장 보내고 idle. 답장이 먼저 전달되고, idle은 큐잉.
2. Lead가 답장 accept, Codex 리뷰 시작 (5분+).
3. Codex가 Major findings 반환. Lead가 라운드 N+1 mint, 송신.
4. **이제서야** step 1에서 큐잉된 idle이 도착.
5. Lead는 라운드 N+1의 답장을 기다리는 중인데 idle이 보인다. 나이브한 로직: "Teammate가 답장도 없이 idle로 들어갔네 — corrective 보내야겠다."
6. Lead가 fresh-id corrective mint해서 송신. Teammate는 여전히 라운드 N+1 작업 중인데 mailbox에 솔리시테이션이 *두 개* 쌓였다.
7. Teammate가 라운드 N+1에 먼저 답장. Lead가 보기엔 이건 *원래* 라운드 N+1의 id지 corrective의 id가 아니다 — 그래서 stale로 보인다. Lead가 또 다른 corrective mint.
8. 루프가 수렴하지 않는다. 매 라운드마다 idle이 한 라운드 늦게 도착하고, 그때마다 새 corrective가 시작된다.

이게 1-round-lag race다. 원인 파악하기 전까지 도그푸딩 오후 하나가 통째로 날아갔다.

수정은 **timestamp guard**다. Lead는 매 `SendMessage` 직전에 Bash `date -u +%FT%TZ`로 `solicit_sent_at`을 캡처한다. `idle_notification` payload는 teammate의 `idle.timestamp`를 가져온다 — teammate가 *실제로* idle로 들어간 wall-clock. `idle.timestamp < solicit_sent_at`이면 이 idle은 현재 솔리시테이션의 응답일 수가 없다. Silently 무시, 계속 대기.

이 guard가 프로토콜에 들어간 이유는 일반화가 된다: **persistent teammate + 라운드 사이 long-running blocking step**인 모든 루프에서는 lead의 send에 anchor된 timestamp가 필요하다. Teammate 답장 기준이 아니라. 안 그러면 이전 라운드 delivery가 현재 라운드를 사칭한다.

## #4 — `assistant-turn-start`는 send 직전 `date -u`의 대용품이 아니다

여기서 솔깃한 단축경로는 lead의 현재 turn-start 시각을 `solicit_sent_at`으로 쓰는 거다. "공짜다" — 이미 컨텍스트에 있고 — *거의* 맞다.

거의 맞지, 맞는 게 아니다. Lead 한 턴은 이럴 수 있다:

1. Wall-clock `T`에 시작.
2. 5분 동안 Codex review JSON 받음.
3. Fresh id mint.
4. Wall-clock `T + 5min`에 다음 솔리시테이션 송신.

이전 라운드의 큐잉된 idle이 `idle.timestamp = T + 2min`이라면 turn-start와 actual-send 사이에 정확히 끼인다. `T`랑 비교하면 "이 idle은 내 라운드 시작 후에 왔으니까 새 솔리시테이션 응답이군" — 그럴 수가 없다. 그 솔리시테이션의 `SendMessage`는 아직 일어나지도 않았다.

프로토콜은 `date -u`를 **`SendMessage` 직전의 마지막 tool call**로 강제한다. 매번. 스펙 문구 — *"the field-definition rule above is binding — assistant-turn start is NOT valid"* — 가 들어간 건, 누군가(나) Bash 호출을 최적화로 빼버렸다가 race를 다시 끌어들였기 때문이다.

프로토콜에서 가장 작은 구체적 수정이다. 그리고 내가 가장 늦게 믿게 된 수정이기도 하다.

## #5 — `expected_request_id == null` collapse

Request-id 카운터와 timestamp guard가 자리잡으면 상호작용하는 state 변수가 둘 생긴다: `expected_request_id` (lead가 기다리는 id, 안 기다리면 `null`)와 `awaiting_reply` (boolean). 합치고 싶어진다 — *`expected_request_id == null`이 곧 `awaiting_reply == false` 아닌가?*

값 레벨에서는 같다. *분류 레벨*에서는 안 같다. Phase가 둘이다:

**Phase 1** (`awaiting_reply == false`): lead는 아무것도 안 기다린다. 이 phase에 `WROTE:`가 들어오면 정의상 stale 또는 중복이다 — 매칭할 현재 id가 없다. `request_id_counter` (지금까지 mint된 마지막 id)에 비교해야 하지, `expected_request_id` (지금 `null`)랑 비교하면 안 된다. Phase를 합치면 분류 도중에 `null`이랑 비교하거나, stale duplicate를 fresh reply랑 같은 accept 로직에 던지게 된다 — null check 순서에 따라 각각이 silently violation이 되거나 success가 된다.

**Phase 2** (`awaiting_reply == true`): lead는 정확히 `expected_request_id`를 기다린다. 이제 `reqid < expected_request_id`는 stale leftover (무시 + 계속 대기), `reqid == expected_request_id`는 candidate genuine reply (accept rule 실행), `reqid > expected_request_id`는 불가능 (teardown)이다.

두 phase가 delivery를 서로 다른 규칙으로 라우팅하고, 그중 하나는 *silent ignore*다. Phase 분리를 건너뛰면 stale duplicate에 corrective를 계속 escalate하거나 (루프 안 수렴), stale을 답장으로 받아들이거나 (잘못된 콘텐츠로 수렴)다.

이 교훈도 이 루프 너머로 일반화된다: busy state와 idle state가 있고 둘 다에 input이 들어오는 state machine에서, 두 state의 라우팅 로직은 따로 작성해야 한다. "둘이 똑같아 보이는데 합치자" 본능이 long-running async protocol을 fragile하게 만드는 정확한 원인이다.

## 이 프로토콜의 정체

위 다섯 섹션 하나하나가 도그푸드된 실패 하나를 사 온다. Reviewer (Codex)는 long-running이다. Teammate는 persistent다. 런타임이 메시지와 idle wake를 deliver하고, lead가 그걸 라우팅한다. **프로토콜은 그 라우팅 테이블이고**, 모든 엔트리는 다르게 라우팅하면 발생하는 버그를 내가 실제로 봤기 때문에 있다.

그게 동시에 이 프로토콜이 우아하지 않은 이유다. 첫 원칙으로부터의 일관된 디자인이 아니라 실패의 침전물이다. Cross-loop 섹션 두 개 — `§E` (request-id state machine)와 `§B` (unsolicited messages) — 가 `plan-loop`과 `implement-loop`이 공유하는 부분을 모으고, 각 루프의 로컬 `failure-protocol.md`가 loop-specific bit를 묶는다: reply-token 형태 (`WROTE: <id> <path>` vs. `DONE: <id> <task>`), accept regex, post-acceptance validation.

다시 짠다면: request-id 카운터, 답장의 `SendMessage` 전송, `solicit_sent_at` timestamp — 이 셋이 실패 면적의 80%를 먹는다. 나머지는 fence-posting이다 — phase 분리, unsolicited-message backstop, teardown 순서 — 명백한 버전이 새벽 2시에 깨진 다음에야 필요하다는 걸 깨닫게 되는 종류.

hyperclaude를 빼고 일반화하면: **persistent teammate + long-running reviewer는 prompt-only discipline으로 못 막는 race를 만든다.** Lead가 id를 소유하고, timestamp를 소유하고, 모든 delivery를 "방금 보낸 것에 대한 답장"이 아니라 router input으로 다뤄야 한다. 이 멘탈 모델만 자리잡으면 나머지는 bookkeeping이다.
