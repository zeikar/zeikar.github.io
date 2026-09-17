---
title: "The Server Finished. The Character Didn't."
subtitle: "My voice character's face kept resetting mid-sentence. Fixing it took a deleted heuristic, a barge-in that asked the wrong question, and a mock that tested an event order the SDK can't produce."
date: 2026-09-17
lang: en
translations:
  ko: /blog/ko/the-server-finished-the-character-didnt/
description: "In realtime voice, 'the server finished sending', 'the response is done' and 'the user heard it' are three different moments. How mixing them up broke expressions, barge-in and interrupts in Charivo, on OpenAI Realtime and Gemini Live."
---

[Charivo](/projects/charivo/) puts a Live2D character on a canvas and lets it hold a voice conversation, over OpenAI Realtime (WebRTC) or Gemini Live (WebSocket). The model can call a `setExpression` tool mid-reply, and the renderer holds that expression until the speech it came with is over. "Over" is the `tts:audio:end` event: when it fires, `RenderManager` releases the held expression and stops lip sync.

The bug was one sentence long. The character smiles, then its face snaps back to neutral while it's still talking.

## Sent is not heard

The OpenAI transport took `tts:audio:end` from the Agents SDK's `audio_stopped` event. The name sounds right. Here is where it comes from in `@openai/agents-realtime` 0.8.5, the version Charivo pins:

```js
// openaiRealtimeBase.js
if (parsed.type === 'response.output_audio.done') {
    this.emit('audio_done');
// realtimeSession.js
this.#transport.on('audio_done', () => {
    this.emit('audio_stopped', this.#context, this.#currentAgent);
```

`response.output_audio.done` means the server has finished *sending* audio. Over WebRTC the browser still has seconds of it buffered, so the end arrived early and the face reset mid-sentence.

There are three moments hiding behind "the reply is over", and every bug in this post came from reading one as another:

| moment | OpenAI Realtime | in Charivo |
|---|---|---|
| **sent**: the server has streamed all the audio | `response.output_audio.done` | the SDK raises `audio_stopped` |
| **done**: the response is finished | `response.done` | `response.status` becomes `"completed"` |
| **heard**: the browser has stopped playing | `output_audio_buffer.stopped` (`.cleared` on an interrupt) | what `tts:audio:end` has to mean |

## A heuristic, four times

My first fix ([`4dbc175`](https://github.com/zeikar/charivo/commit/4dbc175)) didn't use an event at all. The lip-sync analyzer already measures the audio coming out of the stream, so I sampled it:

```ts
const AUDIO_DRAIN_RMS_THRESHOLD = 0.02;
const AUDIO_DRAIN_SILENCE_MS = 250;
const AUDIO_DRAIN_POLL_MS = 50;
const AUDIO_DRAIN_MAX_WAIT_MS = 5_000;
```

On `audio_stopped`, poll every 50 ms. Once the level has stayed under 0.02 for 250 ms, playback is over. A five-second ceiling covers a meter that stops updating, like a background tab throttling `requestAnimationFrame`.

The automated code reviewer, Codex running in my [hyperclaude](/projects/hyperclaude/) implement loop, sent it back. With no analyzer attached, the meter's initial zero read as silence, so the end fired after about 300 ms. The ceiling ended playback even while the meter read loud. And speech has pauses longer than 250 ms.

Round two ([`39aa63a`](https://github.com/zeikar/charivo/commit/39aa63a)) raised the window to 800 ms, tracked when the last sample arrived, and applied the ceiling only when the meter was blind. Sent back: the blind timeout was counted from `audio_stopped` instead of from when the samples stopped, and 800 ms of silence still can't prove a buffer is empty. Round three ([`b15c766`](https://github.com/zeikar/charivo/commit/b15c766)) fixed the clock and was sent back again, this time pointing at the event I'd skipped. The transport already received `output_audio_buffer.stopped`, and the *other* OpenAI client in the same package already treated it as completion.

Round four ([`7144cca`](https://github.com/zeikar/charivo/commit/7144cca)) made that event authoritative and kept the heuristic as a fallback in case the event never arrived. Sent back once more, because the fallback could still fire first, and there is no taking it back afterwards. Once `RenderManager` has released the expression, a later "actually, still playing" doesn't un-release it.

Round five ([`7bb0009`](https://github.com/zeikar/charivo/commit/7bb0009)) deleted the heuristic: 55 lines added, 373 removed. Four more rounds tidied the edges (`output_audio_buffer.cleared` on interrupts, connection loss during tail playback, leftover analyzer samples reopening a finished segment), and the chain came back clean. First commit to last took 47 minutes.

The client I'd been pointed at wasn't clean either. It handled `output_audio_buffer.stopped` in the same `case` as the send events:

```ts
case "response.audio.done":
case "response.output_audio.done":
case "output_audio_buffer.stopped":
  // …
  this.emitEvent({ type: "audio.output.ended" });
```

Whichever arrived first ended the audio, and the send events arrive while audio is still buffered. Three days later it lost those two lines ([`4792908`](https://github.com/zeikar/charivo/commit/4792908)).

## The demo asked the wrong question

A week after the heuristic came out, I made typing work as barge-in: if the character is mid-reply, a typed message interrupts it first ([`83b40cd`](https://github.com/zeikar/charivo/commit/83b40cd)). The check was `state.response.status === "responding"`.

Charivo's `response.status` flips to `"completed"` at the *done* moment, and playback runs well past it. A message typed while the character was finishing its sentence found the turn already completed, skipped the interrupt, and went out as an ordinary send. The old line played to its end and the new answer followed it, instead of cutting in. Half an hour later ([`1d9baba`](https://github.com/zeikar/charivo/commit/1d9baba)) the demo tracked playback from `tts:audio:start` / `tts:audio:end`, which by then meant *heard*, and the realtime state gained an `audioPlaying` field so nobody has to rebuild that from events ([`7884f77`](https://github.com/zeikar/charivo/commit/7884f77)).

## Cancel doesn't stop the sound

The review of that work found the same confusion one layer down ([`6a476b8`](https://github.com/zeikar/charivo/commit/6a476b8)). The low-level OpenAI transport's `interrupt()` returned early unless a response was still generating. After `response.done`, which is exactly the tail-playback window a barge-in exists for, it did nothing. And when it did act, it sent `response.cancel`, which stops generation, not the audio already buffered. It never sent `output_audio_buffer.clear`.

The demo hadn't shown this because it runs on the Agents SDK transport, whose `interrupt()` clears the buffer on every call:

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

## Gemini: a clock and a queue

Gemini Live has no output-buffer event. Charivo's transport receives PCM over the socket and schedules it with Web Audio itself, so *heard* has to be worked out locally. Before writing the transport I measured the API live; the record is in [`tests/gemini-live-smoke/README.md`](https://github.com/zeikar/charivo/blob/main/tests/gemini-live-smoke/README.md). Two signals looked usable, and each was wrong on its own.

The first is `turnComplete`. The server streams audio far faster than real time, then holds `turnComplete` back until the moment that audio would finish playing:

```
first audio chunk          +1439 ms
generationComplete         +4346 ms    (10.56 s of audio delivered)
turnComplete              +12005 ms
first chunk + 10.56 s     +11999 ms
```

In a browser run, `turnComplete` landed at +12034 ms and the last buffer's `onended` at +12037 ms, three milliseconds apart. That closeness is the trap. The server is running a clock, not listening to your speakers, so a shortcut built on `turnComplete` passes every test you're likely to run and only fails when the network stalls.

The second is the local queue draining, and the same measurements rule it out. A turn's opening chunk is short enough to finish before the next one arrives, so the scheduler empties and reports "drained" 3 ms into a twelve-second reply.

So the end of Gemini audio needs both: a drain *and* `turnComplete`, fired by whichever lands second. If the queue is already idle when `turnComplete` arrives, the end fires right then. The transport asks the scheduler whether it's idle at that moment rather than remembering an earlier drain, because the drain that ends a turn and the spurious one that opens it are the same event. Both orders showed up on real hardware, each with exactly one start/end pair.

## The late turn that unlocked the next one

Interrupting opened one more gap. `RealtimeManager` holds a send lock while a reply is in flight. After interrupt, then a replacement send, the cancelled turn's completion could still arrive. The handler cleared the lock *before* checking whether that turn had been interrupted, so the stale completion released the lock the replacement still held and let a duplicate send through. Moving the check first fixed that case ([`9e8d8c2`](https://github.com/zeikar/charivo/commit/9e8d8c2)).

The next plan went after the stale events in the Agents SDK transport, and its regression test was a mock that fired the replacement's `response.created` before the cancelled response's `response.done`. Review rejected it: in the pinned SDK, the `ResponseCreateSequencer` doesn't send a new `response.create` while a response is still ongoing. The mock had manufactured the hole it was testing.

From that I concluded there was nothing to fix, which was wrong in the other direction. Driving the real adapter and the real manager together, over an order the SDK *can* produce, showed a different path ([`7077051`](https://github.com/zeikar/charivo/commit/7077051)). `interrupt()` resets the adapter's "assistant started" flag. When the cancelled turn's `agent_end` finally arrives, the adapter calls `ensureAssistantStarted()`, which announces the dead turn again. The manager moves back to `"responding"`, takes the completion as the current turn's, and releases the replacement's lock.

The fix ([`0f03dc3`](https://github.com/zeikar/charivo/commit/0f03dc3), [`77a94ea`](https://github.com/zeikar/charivo/commit/77a94ea)) marks a response as condemned only when the wire proves it's in flight at interrupt time, and drops that response's assistant events until it reports. Nothing is incremented on send, so a counter can't drift and swallow a real turn's completion. The windows this doesn't cover, like an interrupt issued before the turn's first server event, are listed as a known gap in the [realtime guide](https://github.com/zeikar/charivo/blob/main/docs/guide/realtime.md).

## A test against the real thing

By now mocks had misled me in both directions, so the last commit ([`06cb391`](https://github.com/zeikar/charivo/commit/06cb391)) runs interrupt-and-replace against a live OpenAI session. The first two assertions I wrote for it were wrong:

- **Counting lock releases** failed with the fix in place. The fake microphone can trip server VAD into an extra turn, so a count of turns measures the harness, not the code.
- **Asserting that no completion arrives before the replacement's first event** passed with the fix *removed*. With its deltas suppressed, the stale report looks exactly like a short real turn, and it can land after the replacement has started. Order alone can't tell them apart.

What does tell them apart is the text. Only the interrupted turn carries what that turn was saying:

```ts
const head = partial.slice(0, 24);
expect(laterDoneTexts.filter((text) => text.includes(head))).toEqual([]);
```

With the swallow removed from the adapter, the spec fails. With it restored, it passed twice in a row.

## Where the contract landed

The realtime guide now defines `tts:audio:end` as playback finished, and says no timer or audio-level heuristic stands in for that, because a guessed end can't be undone once an expression has been released.

"Is the character still talking?" is `state.audioPlaying`. On OpenAI, `state.response.status` reads `"completed"` for the whole tail of every turn. On Gemini it completes at `turnComplete`, which is on time only while the network is.
