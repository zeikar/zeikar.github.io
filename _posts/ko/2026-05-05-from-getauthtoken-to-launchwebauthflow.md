---
title: "Chrome 확장 프로그램에서 getAuthToken이 로그인 취소를 놓칠 때"
subtitle: "계정 선택 창을 닫아도 응답이 오지 않아 keepalive와 timeout으로 버티다가, 취소를 확실히 알려주는 launchWebAuthFlow로 옮겨 둘 다 걷어냈다."
date: 2026-05-05
unit: commentarium
last_modified_at: 2026-11-18
translations:
  en: /blog/from-getauthtoken-to-launchwebauthflow/
description: "chrome.identity.getAuthToken이 로그인 취소 콜백을 떨궈 서비스 워커가 멈출 때: keepalive와 timeout이 Chrome의 5분 제한과 부딪힌 이유와, launchWebAuthFlow로 옮기며 바꾼 코드와 OAuth client 설정."
---

[Commentarium](https://commentarium.app) 확장 프로그램은 모든 페이지에 댓글 iframe을 띄우고, 로그인은 서비스 워커가 대신 처리한다. 구조는 [지난 글](/blog/ko/from-chrome-cookies-to-chips/)에 적었다. iframe이 `chrome.runtime.sendMessage`로 "Google 로그인"을 요청하면, 서비스 워커는 원래 이렇게 Firebase에 로그인했다.

```ts
const { token: accessToken } = await chrome.identity.getAuthToken({ interactive: true });
const credential = GoogleAuthProvider.credential(null, accessToken);
await signInWithCredential(auth, credential);
```

Chrome의 계정 선택 창이 뜨고, 계정을 고르면 access token이 돌아오고, 그걸 Firebase credential로 바꾸면 끝이다. 계정을 고르지 않고 창을 닫기 전까지는 그랬다.

## 계정 선택 창을 닫으면

창을 닫아도 로그인 버튼의 스피너가 계속 돌았다. 한참 뒤에야 "Authentication failed"가 떴고, iframe 콘솔에는 이런 에러가 남아 있었다.

```
Unchecked runtime.lastError: A listener indicated an asynchronous response by returning true,
but the message channel closed before a response was received
```

서비스 워커의 메시지 핸들러는 `true`를 반환해 비동기로 답하겠다고 해 놓고 `getAuthToken`을 await하고 있었다. 보통은 사용자가 창을 닫으면 Chrome이 `"The user did not approve access."` 에러로 이 Promise를 reject한다. 그런데 가끔 그 콜백이 아예 오지 않았다. Promise는 resolve도 reject도 되지 않고, await는 그대로 멈춘다.

여기에 MV3 서비스 워커의 수명 규칙이 겹친다. 서비스 워커는 이벤트를 받거나 확장 프로그램 API를 부를 때마다 30초짜리 idle 타이머를 다시 시작하고, 그동안 아무 일도 없으면 종료된다. 멈춘 await는 아무 일도 아니어서 30초쯤 지나면 서비스 워커가 내려가고, 메시지 채널이 닫히고, iframe은 구조 없는 채널 에러를 받는다. 사용자에게는 이유를 알 수 없는 실패다.

## keepalive와 timeout

먼저 손댄 건 서비스 워커를 살려 두고, 오지 않는 콜백에는 상한을 거는 것이었다.

```ts
async function signInGoogleOp(): Promise<AuthResponse> {
  // OAuth가 진행 중인 동안 서비스 워커를 살려 둔다.
  const keepAlive = setInterval(() => {
    void chrome.runtime.getPlatformInfo().catch(() => {});
  }, 20_000);

  // 콜백이 끝내 오지 않아도 상한에서 끝나도록 timeout과 경주시킨다.
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

`chrome.runtime.getPlatformInfo()`는 부작용이 없는 가장 가벼운 `chrome.*` 호출이라, 20초마다 부르면 idle 타이머가 계속 초기화된다. timeout은 콜백이 끝내 오지 않을 때 `identity/timeout`이라는 이름 있는 에러를 돌려준다.

처음 잡은 timeout은 5분이었고, 커밋 전 리뷰에서 걸렸다. Chrome은 이벤트나 API 요청 하나가 5분 넘게 걸리면 keepalive와 상관없이 서비스 워커를 [종료한다](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle). 계정 선택 창이 열린 뒤로 `getAuthToken` 호출이 바로 그 요청이었으니, 5분 timeout은 이 제한과 경주하는 셈이었다. Chrome이 먼저 서비스 워커를 내리면 timeout은 울리지도 못하고 처음의 채널 에러로 돌아간다.

그래서 [60초로 내려서 커밋했다](https://github.com/zeikar/commentarium-extension/commit/4134ae2). 이제 에러에 이름은 붙었지만, 창을 닫은 사용자는 여전히 1분을 꼬박 기다려야 그 에러를 본다. keepalive가 서비스 워커를 살려서 하는 일은 결국 60초 뒤에 "포기했다"를 전하는 것뿐이었다. 문제는 서비스 워커의 수명이 아니라, 취소 신호가 `getAuthToken` 안 어딘가에서 사라진다는 데 있었다. 그 부분은 바깥에서 고칠 수 없다.

## launchWebAuthFlow로 바꾸기

`chrome.identity`에는 대화형 로그인 API가 두 개 있다.

| API | 여는 것 | 취소 신호 |
|---|---|---|
| `getAuthToken` | Chrome 내부 계정 선택 창 | 가끔 오지 않음 |
| `launchWebAuthFlow` | OAuth URL을 띄운 일반 브라우저 창 | 창을 닫으면 Promise reject, provider가 거부하면 redirect URL fragment에 `error=access_denied` |

`launchWebAuthFlow`는 진짜 브라우저 창을 띄운다. 사용자가 창을 닫으면 Chrome이 Promise를 확실히 reject하고, 그 사이에서 닫힘 이벤트를 삼킬 내부 UI가 없다. 대신 "토큰만 달라"는 `getAuthToken`의 편의는 포기해야 한다. OAuth URL을 직접 만들어 넘기고, 돌아온 redirect URL의 fragment를 직접 파싱한다.

Firebase 쪽은 그대로 두려고 `response_type=token`을 썼다. 그러면 redirect가 `access_token`을 싣고 오고, 그걸 전처럼 `GoogleAuthProvider.credential(null, accessToken)`에 넘기면 된다. ID token을 받을 때처럼 nonce를 검증할 필요도 없다.

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

  // (URL 파싱 실패, access_token 누락 처리는 생략)
  const fragment = new URLSearchParams(new URL(responseUrl!).hash.slice(1));

  // 다른 필드를 읽기 전에 state부터 검증한다.
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
  // ...Firebase 로그인은 이전과 동일
}
```

취소는 창을 닫은 경우든 `access_denied`든 `auth/popup-closed-by-user`로 돌려준다. 웹에서 `signInWithPopup` 창을 닫을 때 Firebase가 내는 코드라, 웹앱 로그인 모달에는 이 코드를 받으면 "Sign-in was cancelled"를 띄우는 분기가 원래 있었다. 웹앱은 고칠 게 없었다.

`state`는 다른 fragment 필드보다 먼저 검증한다. 성공 redirect든 에러 redirect든 `state`를 그대로 돌려주니, 이걸 먼저 확인하면 그 뒤의 처리는 모두 CSRF 검사를 통과한 값만 다룬다. 남이 만든 redirect가 `error=access_denied`를 끼워 넣어 "사용자가 취소했다"로 위장하는 것도 막힌다.

keepalive와 timeout은 지웠다. 이제 로그인은 창을 직접 띄우고 관리하는 `launchWebAuthFlow` 안에서 끝나고, 취소도 바로 돌아오니 서비스 워커의 수명을 따로 늘릴 일이 없다.

## OAuth client를 Web application으로

`getAuthToken`에 쓰던 "Chrome App" 타입 OAuth client는 `launchWebAuthFlow`에 쓸 수 없다. Chrome App client는 매니페스트의 `oauth2` 필드에 묶여 있고, 쓸 수 있는 redirect URI가 없다. Google Cloud Console에서 "Web application" client를 새로 만들고, 인가된 redirect URI에 `https://<EXTENSION_ID>.chromiumapp.org/`를 정확히 넣어야 한다. `chrome.identity.getRedirectURL()`이 돌려주는 값이 이것이라 끝의 슬래시까지 맞아야 한다. 매니페스트의 `oauth2` 필드는 쓰는 곳이 없어져서 지웠다.

로컬 개발에도 걸리는 게 하나 있다. unpacked로 올린 확장 프로그램은 매니페스트의 `key`로 고정하지 않으면 배포판과 ID가 다르고, ID가 다르면 redirect URI도 달라서 Google이 `redirect_uri_mismatch`로 거절한다. 다행히 배포된 웹앱이 하드코딩된 배포판 ID로 `sendMessage`를 보내기 때문에, 로컬 서비스 워커가 그 메시지를 받으려고 이미 `VITE_EXTENSION_KEY`로 ID를 고정해 두고 있었다. 그 고정 덕분에 로컬에서도 `getRedirectURL()`이 Cloud Console에 등록한 URI와 그대로 맞았다.

## 바뀐 것

| | getAuthToken + keepalive | launchWebAuthFlow |
|---|---|---|
| 취소 감지 | 가끔 콜백이 오지 않음 | 창을 닫으면 바로 reject |
| 서비스 워커 keepalive | 20초마다 ping | 없음 |
| Timeout | 60초 (5분은 Chrome 수명 제한과 경주) | 없음 |
| 취소한 사용자가 기다리는 시간 | 60초 뒤 `identity/timeout` | 바로 `auth/popup-closed-by-user` |
| OAuth client | Chrome App (매니페스트 `oauth2`) | Web application (Cloud Console redirect URI) |
| state 검증 | 없음 (Chrome이 내부에서 처리) | fragment를 읽기 전에 직접 검증 |
| `signInGoogleOp` 코드 줄 수 (주석, 빈 줄 제외) | 49 | 90 |

코드는 URL 조립과 fragment 파싱, 에러 매핑만큼 40줄쯤 늘었고, 타이머 두 개가 사라졌다. 마이그레이션은 커밋 [`7b95db1`](https://github.com/zeikar/commentarium-extension/commit/7b95db1)이다.
