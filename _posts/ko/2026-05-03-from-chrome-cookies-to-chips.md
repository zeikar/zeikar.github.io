---
title: "Chrome 확장 프로그램 iframe 인증: chrome.cookies에서 CHIPS로"
subtitle: "Chrome 익스텐션의 iframe이 3rd-party 쿠키 차단 환경에서 브라우저를 우회하지 않고 어떻게 인증받는가."
date: 2026-05-03
last_modified_at: 2026-09-28
translations:
  en: /blog/from-chrome-cookies-to-chips/
description: "3rd-party 쿠키 차단 환경에서 Chrome 확장 프로그램의 iframe을 인증시키는 법: chrome.cookies API의 함정, CHIPS Set-Cookie 해결책, 두 방식의 diff."
---

3rd-party 쿠키가 막힌 환경에서 Chrome 익스텐션의 iframe을 인증시킨 이야기다. `chrome.cookies` API는 잘못된 도구였고, 정답은 표준 CHIPS `Set-Cookie` 속성이었다.

변경 자체는 결국 굉장히 기계적이었다. 다만 거기까지 가는 길에 브라우저를 우회하면 실제로 어떤 비용을 치르는지 제대로 배웠다.

세팅은 단순하다. [Commentarium](https://commentarium.app)은 아무 URL에나 댓글을 달 수 있는 웹앱이고, [Chrome 익스텐션](https://github.com/zeikar/commentarium-extension)은 모든 페이지에 사이드 패널을 붙이고 그 안에 `commentarium.app/comments?url=…` iframe을 띄운다. 즉 iframe은 임의의 top-level 사이트에 임베드된 `commentarium.app` 콘텐츠다. 교과서적인 third-party 컨텍스트.

Chrome은 시크릿 모드에서 third-party 쿠키를 기본으로 막고, 일반 창에서도 설정 하나로 막을 수 있다. 막히면 iframe의 세션 쿠키가 안 박혀서 사용자가 로그인할 수 없고, 로그인 못 하면 댓글도 못 단다. third-party 컨텍스트에서 제품 자체가 죽는다.

처음 세운 방법은 잘 돌아갔다. 그러다 안 됐다.

## 1차 시도: chrome.cookies로 partitioned 쿠키 굽기

MV3 broker 패턴은 어느 정도 정착돼 있다. service worker가 인증 상태의 source of truth가 되고, iframe은 `chrome.runtime.sendMessage` (그리고 `externally_connectable.matches` gate)로 SW와 통신한다. 로그인 시 SW는 이렇게 동작한다:

1. `chrome.identity.getAuthToken` + `signInWithCredential`로 Firebase ID token 획득.
2. `Authorization: Bearer <idToken>`을 달고 `/api/login` POST.
3. 서버에서 `{ session, expiresAtSeconds }` 응답.
4. 응답 쿠키를 SW가 직접 `chrome.cookies.set({ url, name: "session", value, partitionKey })`로 굽기.

4번이 핵심이었다. `chrome.cookies` API에 `partitionKey` 지원이 막 들어왔으니 (Chrome 119+), SW가 iframe의 CHIPS 파티션 jar를 정확히 명시해서 쿠키를 굽는다. 단위 테스트 다 통과. `localhost`에서 manual smoke OK. 동료에게 QA 부탁.

다음날 아침: 처음 테스트한 페이지에선 작동, 다른 모든 페이지에선 실패.

함정은 Chrome 문서에 묻혀 있었다:

> 파티션 쿠키를 `chrome.cookies.set`으로 쓰려면 쿠키의 host가 아니라 **파티션의 top-level 사이트**에 대한 `host_permissions`가 필요합니다.

다시 읽어보자. 익스텐션에는 이미 `host_permissions: ["https://commentarium.app/*"]`가 있었다. 즉 `commentarium.app`용 쿠키는 쓸 수 있다. 근데 그 권한이 파티션 jar의 top-level 사이트까지 덮지는 않는다. 예를 들어 iframe이 `https://example.com` 페이지에 떠 있으면, 거기서 partitioned 쿠키를 쓰려면 `example.com`에 대한 권한이 필요하다.

"해결책"은 `host_permissions: ["<all_urls>"]`. 작동은 하는데, 인스톨 다이얼로그에 **"방문하는 모든 웹사이트의 데이터를 읽고 변경"**이라는 경고가 뜬다. 한 가지 일만 하는 사이드 패널 익스텐션에 이 경고는 치명적이다. 사용자 절반이 도망간다.

사용자 신뢰를 그만큼 깎아 먹을 수는 없었다.

## 전환점

문제를 충분히 오래 노려보면 어느 순간 자명한 답이 떠오를 때가 있다. 애초에 `chrome.cookies`가 필요 없었다. 부탁만 잘 하면 브라우저는 이미 partitioned 쿠키를 쓸 줄 안다. 그 부탁을 위한 표준 cookie attribute도 있다.

```http
Set-Cookie: session=…; Partitioned; SameSite=None; Secure; HttpOnly; Path=/
```

[CHIPS](https://developer.chrome.com/docs/privacy-security/privacy-sandbox/chips)(Cookies Having Independent Partitioned State). 이 속성을 붙이면 브라우저가 알아서 쿠키를 iframe의 파티션 jar(키는 임베딩한 top-level 사이트)에 넣고, 같은 iframe의 후속 요청에 다시 보낸다. 쿠키를 쓰는 주체가 익스텐션이 아니라 서버니까 `host_permissions` 따위 필요 없다.

CHIPS는 원래 이렇게 쓰라고 만든 기능이다. 우리는 그걸 두고 브라우저를 우회하려 했던 거다.

## 2차 시도: 서버 측 Set-Cookie + CHIPS 속성

리디자인에서 SW는 토큰만 내주는 얇은 층으로 줄어든다:

```ts
// SW broker: idToken만 발급, 쿠키도 fetch도 건드리지 않음
async function refreshSessionOp(): Promise<AuthResponse> {
  if (!auth.currentUser) {
    await performSignOutCleanupBestEffort();
    return {
      error: { code: "auth/no-current-user", message: "no signed-in user" },
      signedOut: true,
    };
  }
  const idToken = await auth.currentUser.getIdToken(true);
  return { ok: true, idToken };
}
```

iframe 안에서 보면 `/api/login` 요청은 `commentarium.app`에 대한 same-origin fetch다. iframe 자체는 top-level 사이트 기준으로 third-party지만, iframe 안의 코드가 자기 origin을 부르는 건 same-origin이다. 그래서 iframe이 직접 `/api/login`을 호출한다:

```ts
// iframe 코드: commentarium.app으로 same-origin fetch
const { idToken } = await broker.refreshSession();
await fetch("/api/login", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${idToken}`,
    "X-Commentarium-Surface": "extension",
  },
});
```

서버는 쿠키를 굽는다:

```ts
// /api/login route handler
const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
cookies().set({
  name: "session",
  value: sessionCookie,
  httpOnly: true,
  secure: true,
  sameSite: "none",
  partitioned: isExtensionSurface, // <-- CHIPS 핵심 한 줄
});
```

브라우저가 알아서 올바른 파티션 jar에 넣는다. iframe의 다음 요청부터 그게 따라간다. 끝.

## 두 접근 비교

| | chrome.cookies path | CHIPS path |
|---|---|---|
| `permissions` | `activeTab`, `identity`, `storage`, **`cookies`** | `activeTab`, `identity`, `storage` |
| `host_permissions` | `<all_urls>` (또는 깨짐) | (없음) |
| `minimum_chrome_version` | `132` (`getPartitionKey`용) | `114` (CHIPS GA) |
| 인스톨 다이얼로그 | "방문하는 모든 사이트 데이터..." | 최소한의 경고만 |
| 인증 관련 SW 라인 수 | ~300 (mint, partition registry, cleanup) | ~230 (token vending only) |

`host_permissions` 없음, `cookies` 권한 없음, **더 낮은** Chrome 버전 floor (CHIPS가 우리가 의존했던 partition-key API보다 먼저 나옴), 인스톨 시점에 명시적 보안 경고 하나 줄어듦. SW에서 partition-registry 관리 코드 약 70줄 삭제.

## 보너스: revokeRefreshTokens로 크로스 파티션 로그아웃

`auth.revokeRefreshTokens(uid)`는 사용자의 모든 refresh token을 서버 측에서 무효화한다. 인증 라우트들이 extension surface에서 `verifySessionCookie(cookie, /* checkRevoked */ true)`를 쓰면, 어느 파티션에서 로그아웃하든 그 로그아웃이 다른 파티션까지 전파된다. 다른 파티션의 쿠키는 jar에 물리적으로 남아 있어도 다음 요청에서 검증에 실패한다. UI는 401을 잡아서 `commentarium:signed-out` 커스텀 이벤트로 signed-out 상태로 전환한다. 깔끔.

(일부러 손대지 않은 부분도 하나 있다. `commentarium.app`에 직접 들어온 1st-party 컨텍스트는 unpartitioned 쿠키를 쓰는 별개의 sign-in surface다. 그래서 익스텐션에서 로그아웃해도 직접 연 `commentarium.app` 탭은 로그아웃되지 않는다. Slack 데스크톱 앱과 브라우저에서 로그인이 따로 도는 것과 같다. 두 surface는 일부러 나눠 뒀다.)

## 교훈

1. **Chrome API로 우회하기 전에 cookie 스펙부터 보자.** CHIPS는 바로 이런 경우, 즉 임베디드 컨텍스트의 partitioned 쿠키를 위해 존재한다. `chrome.cookies` 문서를 네 번 읽고 나서야 cookie attribute 문서를 처음 읽었다.
2. **Manual E2E는 단위 테스트가 못 잡는 걸 잡는다.** chrome.cookies 실패는 실제 두 번째 도메인에 호스팅된 실제 페이지에서만 보였다. 단위 테스트는 통과했다. mock을 쓰면 브라우저의 권한 체계를 너무 쉽게 건너뛴다.
3. **Service worker는 얇을수록 좋다.** SW가 ID token 발급만 하면, 예상 못 한 문제가 생길 여지가 줄어든다. 삭제된 라인의 대부분은 파티션 시맨틱에 대해 사례 하나만 보고 세운 가정을 끌고 다니던 코드였다.
4. **다른 브라우저에서 CHIPS에 기대기 전에 지원 버전을 확인하자.** Chrome은 114(우리 최소 버전)부터, Firefox는 141부터 지원하고, Safari는 18.4에 넣었다가 뺀 뒤 26.2부터 다시 지원한다. Chrome Web Store용 익스텐션에는 충분하다. 크로스 브라우저 익스텐션이라면 [최신 지원 표](https://caniuse.com/mdn-http_headers_set-cookie_partitioned)를 먼저 볼 것.

diff는 압도적으로 우리 편이었다. 가장 어려운 건 첫 디자인이 틀린 구조였다는 걸 인정하는 거였다.

---

*코드: [commentarium-extension](https://github.com/zeikar/commentarium-extension). CHIPS 리디자인은 [익스텐션 PR #2](https://github.com/zeikar/commentarium-extension/pull/2)로 머지됐다.*
