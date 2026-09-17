---
title: "서버는 끝났는데 캐릭터는 아직 말하고 있었다"
subtitle: "음성 캐릭터의 표정이 말하는 도중에 자꾸 풀렸다. 고치는 길에는 결국 지워버린 heuristic, 엉뚱한 걸 묻던 barge-in, 그리고 SDK가 만들어낼 수 없는 이벤트 순서를 테스트한 mock이 있었다."
date: 2026-09-17
translations:
  en: /blog/the-server-finished-the-character-didnt/
description: "실시간 음성에서 '서버가 다 보냈다', '응답이 끝났다', '사용자가 다 들었다'는 서로 다른 세 순간이다. 이걸 섞어 읽어서 Charivo의 표정, barge-in, interrupt가 OpenAI Realtime과 Gemini Live에서 어떻게 깨졌는지."
---

[Charivo](/projects/charivo/)는 캔버스 위의 Live2D 캐릭터가 음성으로 대화하게 해준다. 연결은 OpenAI Realtime(WebRTC) 아니면 Gemini Live(WebSocket)다. 모델은 답하는 도중에 `setExpression` 툴을 부를 수 있고, renderer는 그 표정을 함께 나온 말이 끝날 때까지 붙잡고 있는다. 여기서 "끝"은 `tts:audio:end` 이벤트다. 이게 뜨면 `RenderManager`가 붙잡고 있던 표정을 풀고 lip sync를 멈춘다.

버그는 한 문장이면 설명된다. 캐릭터가 웃다가, 아직 말하는 중인데 얼굴이 무표정으로 돌아간다.

## 보냈다고 들린 건 아니다

OpenAI transport는 `tts:audio:end`를 Agents SDK의 `audio_stopped` 이벤트에서 가져오고 있었다. 이름만 보면 딱 맞는 이벤트다. Charivo가 고정해 둔 `@openai/agents-realtime` 0.8.5에서 이게 어디서 오는지 보면:

```js
// openaiRealtimeBase.js
if (parsed.type === 'response.output_audio.done') {
    this.emit('audio_done');
// realtimeSession.js
this.#transport.on('audio_done', () => {
    this.emit('audio_stopped', this.#context, this.#currentAgent);
```

`response.output_audio.done`은 서버가 오디오를 다 *보냈다*는 뜻이다. WebRTC에서는 그 시점에도 브라우저 buffer에 몇 초 분량이 남아 있다. 그래서 끝 신호가 일찍 왔고, 얼굴이 문장 중간에 풀렸다.

"답이 끝났다" 뒤에는 서로 다른 세 순간이 숨어 있다. 이 글에 나오는 버그는 전부 그중 하나를 다른 하나로 읽은 데서 나왔다.

| 순간 | OpenAI Realtime | Charivo에서는 |
|---|---|---|
| **sent**: 서버가 오디오를 다 스트리밍함 | `response.output_audio.done` | SDK가 `audio_stopped`를 올림 |
| **done**: 응답이 끝남 | `response.done` | `response.status`가 `"completed"`가 됨 |
| **heard**: 브라우저가 재생을 멈춤 | `output_audio_buffer.stopped` (interrupt면 `.cleared`) | `tts:audio:end`가 뜻해야 하는 것 |

## heuristic, 네 번

첫 수정([`4dbc175`](https://github.com/zeikar/charivo/commit/4dbc175))은 이벤트를 아예 쓰지 않았다. lip-sync analyzer가 스트림에서 실제로 나오는 오디오를 이미 재고 있었으니, 그걸 샘플링했다.

```ts
const AUDIO_DRAIN_RMS_THRESHOLD = 0.02;
const AUDIO_DRAIN_SILENCE_MS = 250;
const AUDIO_DRAIN_POLL_MS = 50;
const AUDIO_DRAIN_MAX_WAIT_MS = 5_000;
```

`audio_stopped`가 오면 50ms마다 polling한다. 레벨이 250ms 동안 0.02 아래에 머물면 재생이 끝난 걸로 본다. 5초 ceiling은 meter가 갱신을 멈추는 경우를 막는다. 백그라운드 탭이 `requestAnimationFrame`을 throttle하는 경우 같은 것.

자동 코드 리뷰어, 그러니까 내 [hyperclaude](/projects/hyperclaude/) implement loop 안에서 도는 Codex가 이걸 돌려보냈다. analyzer가 안 붙어 있으면 meter의 초기값 0이 무음으로 읽혀서 약 300ms 만에 끝 신호가 나갔다. ceiling은 meter가 큰 소리를 읽고 있는 중에도 재생을 끝냈다. 그리고 사람 말에는 250ms보다 긴 쉼이 있다.

2라운드([`39aa63a`](https://github.com/zeikar/charivo/commit/39aa63a))에서는 window를 800ms로 늘리고, 마지막 샘플이 언제 왔는지 추적하고, ceiling은 meter가 blind일 때만 걸었다. 또 반려. blind timeout을 샘플이 끊긴 시점이 아니라 `audio_stopped`부터 세고 있었고, 800ms 무음으로도 buffer가 비었다는 증명은 안 된다. 3라운드([`b15c766`](https://github.com/zeikar/charivo/commit/b15c766))에서 그 시계를 고쳤는데 다시 반려됐고, 이번엔 내가 건너뛴 이벤트를 짚었다. transport는 이미 `output_audio_buffer.stopped`를 받고 있었고, 같은 패키지의 *다른* OpenAI client는 이미 그걸 완료 신호로 쓰고 있었다.

4라운드([`7144cca`](https://github.com/zeikar/charivo/commit/7144cca))는 그 이벤트를 기준으로 삼고, 이벤트가 끝내 안 오는 경우를 위해 heuristic을 fallback으로 남겼다. 그래도 반려. fallback이 여전히 먼저 뜰 수 있었고, 한번 뜨면 무를 방법이 없다. `RenderManager`가 표정을 풀고 나면, 나중에 "사실 아직 재생 중"이라고 해봐야 풀린 표정은 돌아오지 않는다.

5라운드([`7bb0009`](https://github.com/zeikar/charivo/commit/7bb0009))에서 heuristic을 지웠다. 55줄 추가, 373줄 삭제. 그 뒤 네 라운드가 가장자리를 정리했고(interrupt 때의 `output_audio_buffer.cleared`, 꼬리 재생 중 연결 끊김, 끝난 segment를 다시 여는 analyzer 잔여 샘플), 체인은 clean으로 끝났다. 첫 커밋부터 마지막 커밋까지 47분.

그런데 참고하라고 짚어준 그 client도 깨끗하지 않았다. `output_audio_buffer.stopped`를 send 이벤트들과 같은 `case`에서 처리하고 있었다.

```ts
case "response.audio.done":
case "response.output_audio.done":
case "output_audio_buffer.stopped":
  // …
  this.emitEvent({ type: "audio.output.ended" });
```

먼저 도착하는 쪽이 오디오를 끝냈는데, send 이벤트는 오디오가 아직 buffer에 있을 때 도착한다. 사흘 뒤 이 두 줄이 빠졌다([`4792908`](https://github.com/zeikar/charivo/commit/4792908)).

## 데모는 엉뚱한 걸 묻고 있었다

heuristic을 지우고 일주일 뒤, 타이핑으로도 barge-in이 되게 했다. 캐릭터가 답하는 중이면 입력한 메시지가 먼저 interrupt를 건다([`83b40cd`](https://github.com/zeikar/charivo/commit/83b40cd)). 조건은 `state.response.status === "responding"`이었다.

Charivo의 `response.status`는 *done* 시점에 `"completed"`로 바뀌고, 재생은 그보다 한참 더 간다. 캐릭터가 문장을 마무리하는 사이에 입력한 메시지는 이미 완료된 턴을 보고 interrupt를 건너뛴 채 평범한 send로 나갔다. 이전 대사는 끝까지 재생됐고, 새 답은 끼어드는 대신 그 뒤에 이어졌다. 30분 뒤([`1d9baba`](https://github.com/zeikar/charivo/commit/1d9baba)) 데모는 `tts:audio:start` / `tts:audio:end`로 재생 상태를 추적하게 됐다. 이때쯤 이 이벤트는 *heard*를 뜻하고 있었다. realtime state에는 `audioPlaying` 필드가 생겨서, 그걸 이벤트로 직접 재구성할 필요도 없어졌다([`7884f77`](https://github.com/zeikar/charivo/commit/7884f77)).

## cancel은 소리를 멈추지 않는다

그 작업의 리뷰가 한 층 아래에서 같은 혼동을 찾았다([`6a476b8`](https://github.com/zeikar/charivo/commit/6a476b8)). low-level OpenAI transport의 `interrupt()`는 응답이 아직 생성 중이 아니면 그냥 return했다. `response.done` 이후, 그러니까 barge-in이 존재하는 이유인 바로 그 꼬리 재생 구간에서는 아무것도 안 했다는 뜻이다. 뭔가 할 때도 `response.cancel`을 보냈는데, 이건 생성을 멈출 뿐 이미 buffer에 들어간 오디오는 멈추지 않는다. `output_audio_buffer.clear`는 한 번도 보내지 않았다.

데모에서 이게 안 드러난 건 데모가 Agents SDK transport 위에서 돌기 때문이다. 그쪽 `interrupt()`는 호출될 때마다 buffer를 비운다.

```js
interrupt() {
    if (this.#cancelOngoingResponse &&
        this.#responseCreateSequencer.beginCancelResponse()) {
        this.#sendEventNow({ type: 'response.cancel' });
        this.#cancelOngoingResponse = false;
    }
    this.#sendEventNow({ type: 'output_audio_buffer.clear' });
}
```

## Gemini: 시계와 큐

Gemini Live에는 output buffer 이벤트가 없다. Charivo의 transport는 소켓으로 PCM을 받아서 Web Audio로 직접 스케줄링하니, *heard*는 로컬에서 알아내야 한다. transport를 쓰기 전에 API를 실제로 붙어서 측정했고, 기록은 [`tests/gemini-live-smoke/README.md`](https://github.com/zeikar/charivo/blob/main/tests/gemini-live-smoke/README.md)에 있다. 쓸 만해 보이는 신호가 두 개 있었는데, 둘 다 혼자서는 틀렸다.

첫 번째는 `turnComplete`다. 서버는 오디오를 실시간보다 훨씬 빠르게 스트리밍하고 나서, 그 오디오가 재생을 마칠 시점까지 `turnComplete`를 붙잡아 둔다.

```
첫 오디오 chunk            +1439 ms
generationComplete         +4346 ms    (오디오 10.56초 분량 전달)
turnComplete              +12005 ms
첫 chunk + 10.56초        +11999 ms
```

브라우저에서 돌린 run에서는 `turnComplete`가 +12034ms, 마지막 buffer의 `onended`가 +12037ms였다. 3ms 차이. 이 가까움이 함정이다. 서버는 스피커를 듣는 게 아니라 시계를 돌리고 있을 뿐이라, `turnComplete`에 기댄 지름길은 보통 돌려볼 만한 테스트는 다 통과하고 네트워크가 멈칫할 때만 틀린다.

두 번째는 로컬 큐가 비는 것, 즉 drain이다. 같은 측정이 이것도 배제한다. 턴의 첫 chunk는 다음 chunk가 도착하기 전에 재생이 끝날 만큼 짧아서, scheduler가 비어버리고 12초짜리 답의 3ms 지점에서 "drained"를 보고한다.

그래서 Gemini 오디오의 끝에는 둘 다 필요하다. drain *과* `turnComplete`를 모두 보고, 둘 중 늦게 온 쪽에서 끝 신호를 낸다. `turnComplete`가 왔을 때 큐가 이미 idle이면 그 자리에서 끝을 낸다. 이때 transport는 앞서 있었던 drain을 기억해 두는 대신 그 순간 scheduler가 idle인지 직접 묻는다. 턴을 끝내는 drain과 턴 첫머리의 가짜 drain이 같은 이벤트라서다. 실제 하드웨어에서 두 순서가 다 나왔고, 둘 다 start/end 쌍이 정확히 하나였다.

## 늦게 온 턴이 다음 턴의 lock을 풀었다

interrupt가 틈을 하나 더 열었다. `RealtimeManager`는 답이 진행 중인 동안 send lock을 쥐고 있다. interrupt하고 대체 메시지를 보낸 뒤에도, 취소된 턴의 완료 이벤트가 늦게 도착할 수 있었다. handler는 그 턴이 interrupt됐는지 확인하기 *전에* lock부터 풀었다. 그래서 낡은 완료 이벤트가 대체 메시지가 아직 쥐고 있던 lock을 풀어버렸고, 중복 send가 통과했다. 확인을 앞으로 옮기니 이 경우는 고쳐졌다([`9e8d8c2`](https://github.com/zeikar/charivo/commit/9e8d8c2)).

다음 플랜은 Agents SDK transport에서 이 낡은 이벤트들을 잡으려 했고, regression 테스트는 대체 메시지의 `response.created`를 취소된 응답의 `response.done`보다 먼저 쏘는 mock이었다. 리뷰가 반려했다. 고정된 SDK에서 `ResponseCreateSequencer`는 응답이 진행 중인 동안 새 `response.create`를 보내지 않는다. mock이 자기가 테스트하던 구멍을 스스로 만들어낸 거였다.

그걸 보고 나는 고칠 게 없다고 결론 냈는데, 이번엔 반대 방향으로 틀렸다. 실제 adapter와 실제 manager를 같이 돌려서 SDK가 *만들 수 있는* 순서를 태워보니 다른 경로가 나왔다([`7077051`](https://github.com/zeikar/charivo/commit/7077051)). `interrupt()`는 adapter의 "assistant started" 플래그를 리셋한다. 취소된 턴의 `agent_end`가 마침내 도착하면 adapter가 `ensureAssistantStarted()`를 부르고, 이게 이미 죽은 턴을 다시 시작됐다고 알린다. manager는 `"responding"`으로 돌아가고, 그 완료 이벤트를 현재 턴의 것으로 받아서 대체 메시지의 lock을 푼다.

수정([`0f03dc3`](https://github.com/zeikar/charivo/commit/0f03dc3), [`77a94ea`](https://github.com/zeikar/charivo/commit/77a94ea))은 interrupt 시점에 wire가 in-flight임을 증명해주는 응답만 condemned로 표시하고, 그 응답이 보고를 마칠 때까지 assistant 이벤트를 버린다. send할 때 올리는 카운터는 없다. 그래서 카운터가 어긋나서 진짜 턴의 완료를 삼킬 일도 없다. 이 수정이 못 덮는 구간, 예를 들어 턴의 첫 서버 이벤트 전에 건 interrupt 같은 건 [realtime 가이드](https://github.com/zeikar/charivo/blob/main/docs/guide/realtime.md)에 known gap으로 적어 뒀다.

## 진짜를 상대로 한 테스트

이쯤 되니 mock에 양쪽 방향으로 한 번씩 속은 셈이었다. 그래서 마지막 커밋([`06cb391`](https://github.com/zeikar/charivo/commit/06cb391))은 interrupt-and-replace를 실제 OpenAI 세션에 대고 돌린다. 여기에 처음 쓴 assertion 두 개는 틀렸다.

- **lock 해제 횟수를 세는 것**은 수정이 들어간 상태에서 실패했다. 가짜 마이크가 server VAD를 건드려서 턴이 하나 더 생길 수 있다. 턴 수를 세면 코드가 아니라 harness를 재게 된다.
- **대체 메시지의 첫 이벤트 전에 완료가 오지 않는다고 assert한 것**은 수정을 *뺀* 상태에서 통과했다. delta가 억제되면 낡은 보고는 짧은 진짜 턴과 똑같이 생겼고, 대체 메시지가 시작된 뒤에 도착할 수도 있다. 순서만으로는 둘을 못 가른다.

가를 수 있는 건 텍스트다. interrupt된 턴만 그 턴이 하던 말을 담고 있다.

```ts
const head = partial.slice(0, 24);
expect(laterDoneTexts.filter((text) => text.includes(head))).toEqual([]);
```

adapter에서 swallow 로직을 빼면 이 spec은 실패한다. 다시 넣었을 때는 두 번 연속 통과했다.

## 계약은 여기에 자리 잡았다

realtime 가이드는 이제 `tts:audio:end`를 재생이 끝났다는 뜻으로 정의하고, 어떤 timer나 오디오 레벨 heuristic도 그 이벤트를 대신하지 않는다고 적어 둔다. 추측으로 낸 끝은 표정을 한번 풀어버리면 되돌릴 수 없기 때문이다.

"캐릭터가 아직 말하고 있나?"의 답은 `state.audioPlaying`이다. OpenAI에서 `state.response.status`는 매 턴의 꼬리 내내 `"completed"`로 읽힌다. Gemini에서는 `turnComplete`에서 완료되는데, 그게 제시간인 건 네트워크가 멀쩡할 때뿐이다.
