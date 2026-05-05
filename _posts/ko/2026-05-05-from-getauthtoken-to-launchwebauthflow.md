---
title: "Chrome 확장 프로그램 OAuth: getAuthToken에서 launchWebAuthFlow로"
subtitle: "Chrome 계정 chooser가 어쩌다 cancel callback을 조용히 삼키는 이유, 그걸 위한 band-aid가 자기 자신과 race하는 이유, 그리고 둘 다 우회하는 primitive."
date: 2026-05-05
translations:
  en: /blog/from-getauthtoken-to-launchwebauthflow/
description: "chrome.identity.getAuthToken이 cancel callback을 조용히 떨굴 때, MV3 SW idle timer가 그걸 60초 spinner로 만든다. keepalive band-aid는 Chrome의 per-request 5분 cap과 race한다. launchWebAuthFlow가 둘 다 우회하는 primitive다."
---

OAuth에서 cancel을 어떻게 감지할 것인가 — 구체적으로는, Chrome 익스텐션에서 `chrome.identity.getAuthToken`을 어떻게 band-aid로 둘러싸려고 했는지, 그 band-aid가 왜 자기 자신과 race했는지, 그리고 다른 `chrome.identity` primitive로 한 발짝 물러섰더니 band-aid가 사라진 이야기다.

작은 문제지만, 모양은 [지난 CHIPS 포스트](/blog/ko/from-chrome-cookies-to-chips/)와 같다 — 우리는 잘못된 걸 고치려 했다.

## 세팅

빠른 복습: [Commentarium](https://commentarium.app)은 댓글 웹앱이고, [Chrome 익스텐션](https://github.com/zeikar/commentarium-extension)이 모든 페이지에 `commentarium.app/comments?url=…` iframe을 끼워 넣는다. service worker가 iframe과 배포된 웹앱 사이에서 Firebase 인증을 broker한다. 지난 포스트는 *쿠키*가 iframe까지 어떻게 가는지에 대한 이야기였고, 이번 포스트는 SW가 *Firebase ID token*을 애초에 어떻게 만드는지에 대한 이야기다.

지난주까지 그건 한 줄짜리였다:

```ts
const { token: accessToken } = await chrome.identity.getAuthToken({ interactive: true });
const credential = GoogleAuthProvider.credential(null, accessToken);
await signInWithCredential(auth, credential);
```

Chrome 계정 chooser가 뜨고, 사용자가 계정을 고르고, access token이 돌아오고, 그걸 `GoogleAuthProvider.credential`에 넘기면 Firebase가 sign-in 시킨다. 끝.

사용자가 chooser를 아무것도 안 고르고 닫기 전까지는.

## 60초 spinner

QA 보고: "*Google로 로그인* 누르면 chooser가 뜨는데, 닫으니까 spinner가 멈추질 않는다." 얼마나? 약 1분.

1분이라는 건 묘한 시간이다. "영원히"는 아니고 (실제 hang은 사용자 체감으로 더 길게 느껴진다), "즉시"도 아니고 (실제 cancel은 sub-second). 60초는 *budget*이다 — 누군가 timeout을 재고 있는 거다.

SW DevTools console이 결국 답을 준다:

```
Unchecked runtime.lastError: A listener indicated an asynchronous response by returning true,
but the message channel closed before a response was received
```

웹앱의 `chrome.runtime.sendMessage(EXT_ID, { type: "signIn.google" })`가 SW 응답을 기다리고 있었다. SW는 message handler에서 `true`를 반환했고 ("async로 응답하겠다"는 신호), 그 상태로 `chrome.identity.getAuthToken`을 await한 채 멍하니 앉아 있었다. 약 1분 뒤, SW가 idle out 되면서 Chrome이 message channel을 강제로 닫았다. 웹앱은 generic한 channel-closed 에러를 받았고, "Authentication failed"로 표시됐다.

## 왜 60초인가

플랫폼 동작 두 개가 충돌한다.

**Behavior #1**: `chrome.identity.getAuthToken({ interactive: true })`의 cancel callback이 불안정하게 관찰됐다. 대부분의 플랫폼에선 사용자가 chooser를 안 고르고 닫으면 Chrome이 `chrome.runtime.lastError = "The user did not approve access."`로 콜백하고 Promise가 reject된다. 그런데 우리 macOS QA 환경에선 그 path가 callback을 통째로 떨궜다. Promise가 resolve도 reject도 안 된다. await가 그냥 hang.

**Behavior #2**: MV3 service worker는 idle out 된다. 공식적으로는 SW가 처리하는 모든 이벤트마다 리셋되는 30초 타이머다. 응답 대기 중인 message handler는 *원칙상* SW를 살려둬야 하는데, 실제론 hang된 await 위에 그냥 앉아 있으면 30~60초 사이 어딘가에서 SW가 죽는다. SW가 죽으면 message channel이 닫히고, 웹앱이 "channel closed before response"를 본다.

조합하면: cancel path가 발화 안 됨 → SW 영원히 await → SW idle out → channel closed → 웹앱이 ~60초 후에 generic 에러를 본다.

## 1차 수정: keepalive + timeout race

직진형 band-aid:

```ts
async function signInGoogleOp(): Promise<AuthResponse> {
  // OAuth가 진행 중인 동안 SW를 살려둔다.
  const keepAlive = setInterval(() => {
    void chrome.runtime.getPlatformInfo().catch(() => {});
  }, 20_000);

  // hung callback이 영원히 hang하지 못하도록 hard cap과 race.
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject({ code: "identity/timeout", message: "..." }),
      5 * 60 * 1000);
  });

  try {
    const tokenResult = await Promise.race([
      chrome.identity.getAuthToken({ interactive: true }),
      timeoutPromise,
    ]);
    // ...이하 동일
  } finally {
    clearInterval(keepAlive);
  }
}
```

`chrome.runtime.getPlatformInfo()`는 떠올릴 수 있는 가장 가벼운 `chrome.*` 호출이다 — side effect가 없고, 20초마다 ping하면 SW가 idle out 안 된다. 5분 timeout은 cancel callback이 *진짜* 안 올 때 깔끔한 `identity/timeout` 에러를 surface한다.

작동했다. 이제 웹앱이 60초가 아니라 5분 후에 spinner를 멈춘다.

5분이 60초보다 어떻게든 더 나쁜 UX다.

## 자기 자신과 race

코드 리뷰어가 다음 문제를 잡아줬다: Chrome은 익스텐션 service worker의 single event 또는 API request 하나가 ~5분을 넘기면 SW를 [종료한다](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — 옆에서 `chrome.*` 활동이 돌고 있어도 무관하다. 우리 message-handler request는 chooser가 열린 순간부터 `getAuthToken`을 await하고 있었고, *그게* in-flight single request였다. 우리 5분 timeout은 정확히 그 cap과 race하고 있었던 거다. Chrome이 SW를 먼저 죽이면 timer가 발화 못 하고, channel이 깔끔하지 않게 닫히고, 우리는 다시 원래의 "channel closed" 에러로 돌아간다.

timeout을 60초로 낮췄다. cap과 더 이상 race 안 하지만, 사용자는 여전히 1분 꽉 채워서 기다린 후에야 구조화된 응답을 받는다. keepalive는 자기 일을 하고 있다 — SW를 살려두는 일 — 그걸로 60초 후에 "포기했다"를 전달하기 위해서다.

이 지점에서 우리가 잘못된 layer를 패치하고 있다는 게 명백해졌다. keepalive는 *애초에 필요하지 않았어야 할* await를 연장하고 있었다. cancel 신호는 `getAuthToken` 안에서 우리가 볼 수 없는 어딘가에 가만히 있었다.

## 올바른 primitive

`chrome.identity`는 interactive API 두 개를 ship한다:

| API | 여는 것 | Cancel 신호 |
|---|---|---|
| `getAuthToken` | Chrome 내부 계정 chooser | 일부 플랫폼에서 조용히 떨어짐 |
| `launchWebAuthFlow` | OAuth URL을 가리키는 일반 브라우저 윈도우 | 윈도우 close 시 Promise reject; provider deny 시 redirect URL fragment에 `error=access_denied` |

`launchWebAuthFlow`는 진짜 Chromium 윈도우를 연다. 사용자가 X 버튼으로 닫으면 Chrome이 callback을 신뢰성 있게 발화한다 (에러로). close 이벤트를 삼킬 내부 계정 chooser surface가 없다.

`getAuthToken`의 "토큰 줘, 나머지는 네가 알아서"의 편의는 포기한다 — 대신 OAuth URL을 직접 만들고, `launchWebAuthFlow`에 넘기고, 돌아온 redirect URL fragment를 파싱한다. 코드는 대략 15-20줄 더. 그 대가로 cancel path가 ~즉각적이고 관찰 가능해진다.

## 마이그레이션의 모양

기존 Firebase 연결은 그대로 유지했다. 구체적으로 `response_type=token`을 써서 redirect가 `access_token`을 fragment에 싣고 오게 했다 — 그걸 `GoogleAuthProvider.credential(null, accessToken)`에 그대로 넘긴다. `getAuthToken`이 먹이던 그것 그대로. nonce 검증 surface를 도입할 필요가 없다.

```ts
async function signInGoogleOp(): Promise<AuthResponse> {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_OAUTH_WEB_CLIENT_ID,
    redirect_uri: chrome.identity.getRedirectURL(),
    response_type: "token",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  let responseUrl: string | undefined;
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      interactive: true,
    });
  } catch (err) {
    return { error: { code: "auth/popup-closed-by-user", message: "..." } };
  }

  const fragment = new URLSearchParams(new URL(responseUrl!).hash.slice(1));

  // state를 먼저 검증한다 — 다른 필드를 읽기 전에.
  if (fragment.get("state") !== state) {
    return { error: { code: "identity/state-mismatch", message: "..." } };
  }

  const oauthError = fragment.get("error");
  if (oauthError) {
    return {
      error: {
        code: oauthError === "access_denied"
          ? "auth/popup-closed-by-user"
          : "identity/oauth-error",
        message: fragment.get("error_description") ?? oauthError,
      },
    };
  }

  const accessToken = fragment.get("access_token");
  // ...Firebase 블록은 이전과 동일
}
```

세 가지 디테일이 짚을 만하다.

**Cancel을 `auth/popup-closed-by-user`로 매핑.** Firebase의 popup-based OAuth cancellation 표준 에러 코드다. 웹앱에 이미 그 코드 path가 있었다 — 브라우저 플로우의 `signInWithPopup`이 만들어내는 게 그거니까 — 그래서 사용자에게 보이는 "Sign-in cancelled" 카피가 공짜였다. 웹앱 변경 불필요.

**state를 먼저 검증.** 성공/실패 redirect 모두 `state`를 echo한다. 다른 fragment field를 읽기 전에 검증하면 downstream 전체가 CSRF check 위에 올라간다. 악의적으로 만든 redirect가 `error=access_denied`를 "사용자가 cancel함" 신호로 위장해서 끼워넣지 못한다.

**keepalive 없음, timeout race 없음.** 둘 다 사라졌다. OAuth flow가 이제 prompt를 소유한 `launchWebAuthFlow` 안에서 resolve / reject되므로, 별도의 SW keepalive와 사용자 정의 timeout으로 lifetime 제약을 우회할 필요가 없다.

## Cloud Console 주의사항

"Chrome App" 타입 OAuth client_id를 `launchWebAuthFlow`에 재사용할 수 없다. Chrome App client는 manifest의 `oauth2` field에 묶여 있고 임의의 redirect URI를 받지 않는다. "Web application" client_id가 필요하고, 인가된 redirect URI는 정확히 `https://<EXTENSION_ID>.chromiumapp.org/` — trailing slash가 중요하다, `chrome.identity.getRedirectURL()`이 돌려주는 게 그것이니까. 익스텐션의 옛 `oauth2` manifest field는 dead가 되고 제거된다.

(unpacked-dev 워크플로우에 별도 이슈가 하나 있다: 개발자의 로컬 익스텐션 ID는 `key` field로 핀하지 않으면 prod ID와 일치하지 않는다. 배포된 웹앱이 prod EXT_ID를 하드코딩한 `runtime.sendMessage`로 로컬 SW에 닿게 하려면 이미 `VITE_EXTENSION_KEY`로 핀하고 있었다. 이번 마이그레이션 후엔 핀이 `getRedirectURL()`의 결과도 Cloud Console에 인가된 URI와 매칭시킨다. 일석이조.)

## diff는 어땠나

| | getAuthToken path | launchWebAuthFlow path |
|---|---|---|
| Cancel 감지 | 일부 플랫폼에서 조용히 떨어짐 | ~1초 안에 Promise reject |
| SW keepalive ping | 필요 (20초마다) | 없음 |
| Timeout | 필요 (처음엔 5분, SW lifetime cap과 race; 이후 60초) | 없음 |
| Cancel 시 사용자 대기 | ~60초 후 generic 에러 | ~1초, 구조화된 `auth/popup-closed-by-user` |
| OAuth client 타입 | Chrome App (manifest `oauth2`) | Web application (Cloud Console redirect URI) |
| State / CSRF 방어 | 없음 (Chrome 내부 처리) | 명시적, fragment 소비 전 검증 |
| `signInGoogleOp` 라인 수 | ~30 (band-aided) | ~50 (URL build + fragment parse + error 매핑) |

코드 15-20줄 더. timer 저글링 primitive 두 개 사라짐. cancel path UX 60배 개선.

## 교훈

1. **플랫폼 quirk band-aid는 다른 플랫폼 quirk와 race한다.** keepalive + timeout이 우리가 살려두려고 했던 바로 그 SW lifetime cap과 race하고 있었다. 잘못된 layer를 패치한다는 건 한 플랫폼 제약을 다른 플랫폼 제약으로 바꾸는 것뿐이다.
2. **"올바른 primitive"가 "올바른 workaround"를 이긴다.** `launchWebAuthFlow`가 결정론적인 cancel 신호를 가지고 있다는 걸 보고 나니, `getAuthToken` band-aid가 한물간 것처럼 보였다. timer 저글링 30줄은 잘못된 자리에 있던 mass-and-energy였다.
3. **OAuth 응답의 다른 필드를 읽기 전에 `state`를 검증하라.** 성공/실패 redirect 모두 echo한다. 먼저 검사하는 건 공짜 CSRF 방어이고, "취소했는데 앱이 다른 걸 시도했다고 한다" 류의 이상한 보고 카테고리를 통째로 차단한다.
4. **MV3 SW lifetime은 구조적 제약이지 tweak 대상이 아니다.** 30초 idle 타이머와 ~5분 per-request cap을 아키텍처 입력으로 다뤄라. 디자인이 single request를 5분 넘게 끌어야 한다면, 아마 잘못된 모양이다 — 우리가 그랬듯이.

답을 찾고 나니 수정은 다시, 놀랍게도 기계적이었다. 가장 어려운 건 band-aid가 *거의* 작동하고 있던 게 아니란 걸 인정하는 거였다.

---

*코드: [commentarium-extension](https://github.com/zeikar/commentarium-extension). 마이그레이션은 커밋 [`7b95db1`](https://github.com/zeikar/commentarium-extension/commit/7b95db1)으로 머지됐다.*
