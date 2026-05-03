---
title: "Chrome 확장 프로그램 iframe 인증: chrome.cookies에서 CHIPS로"
subtitle: "Chrome 익스텐션의 iframe이 3rd-party 쿠키 차단 환경에서 어떻게 인증받는가 — 브라우저 우회 없이."
date: 2026-05-03
translations:
  en: /blog/from-chrome-cookies-to-chips/
description: "3rd-party 쿠키 차단 환경에서 Chrome 확장 프로그램의 iframe을 인증시키는 법 — chrome.cookies API의 함정, CHIPS Set-Cookie 해결책, 그리고 그 사이의 diff."
---

3rd-party 쿠키를 차단하는 세상에서 Chrome 익스텐션의 iframe을 인증시키는 이야기다. 구체적으로는, 왜 `chrome.cookies` API가 잘못된 도구였고 표준 CHIPS `Set-Cookie` 속성이 정답이었는지.

결국엔 굉장히 기계적인 변경이었다. 거기까지 가는 길이 *브라우저를 우회한다는 게 실제로 어떤 비용을 치르는지*에 대한 날카로운 교훈이었다.

세팅은 단순하다. [Commentarium](https://commentarium.app)은 어떤 URL에든 댓글을 다는 웹앱이고, [Chrome 익스텐션](https://github.com/zeikar/commentarium-extension)은 모든 페이지에 사이드 패널을 붙이고 그 안에 `commentarium.app/comments?url=…` iframe을 띄운다. 즉 iframe은 임의의 top-level 사이트에 임베드된 `commentarium.app` 콘텐츠 — 교과서적인 third-party 컨텍스트.

요즘 브라우저는 third-party 쿠키를 기본으로 차단한다. iframe의 세션 쿠키가 안 박히면 사용자가 로그인할 수 없고, 로그인 못 하면 댓글도 못 단다. third-party 컨텍스트에서 제품 자체가 죽는다.

계획은 있었다. 잘 작동했다. 그러다 안 됐다.

## 1차 시도: chrome.cookies로 partitioned 쿠키 굽기

MV3 broker 패턴은 어느 정도 정착돼 있다 — service worker가 인증 상태의 source of truth가 되고, iframe은 `chrome.runtime.sendMessage` (그리고 `externally_connectable.matches` gate)로 SW와 통신한다. 로그인 시 SW는 이렇게 동작한다:

1. `chrome.identity.getAuthToken` + `signInWithCredential`로 Firebase ID token 획득.
2. `Authorization: Bearer <idToken>`을 달고 `/api/login` POST.
3. 서버에서 `{ session, expiresAtSeconds }` 응답.
4. 응답 쿠키를 SW가 직접 `chrome.cookies.set({ url, name: "session", value, partitionKey })`로 굽기.

4번이 핵심이었다. `chrome.cookies` API에 `partitionKey` 지원이 막 들어왔으니 (Chrome 119+), SW가 iframe의 CHIPS 파티션 jar를 정확히 명시해서 쿠키를 굽는다. 단위 테스트 다 통과. `localhost`에서 manual smoke OK. 동료에게 QA 부탁.

다음날 아침: 처음 테스트한 페이지에선 작동, 다른 모든 페이지에선 실패.

함정은 Chrome 문서에 묻혀 있었다:

> 파티션 쿠키를 `chrome.cookies.set`으로 쓰려면 **파티션의 top-level 사이트**에 대한 `host_permissions`가 필요합니다 — 쿠키의 host가 아니라.

다시 읽어보자. 익스텐션은 이미 `host_permissions: ["https://commentarium.app/*"]`를 가지고 있었다 — 즉 `commentarium.app` *용* 쿠키는 쓸 수 있다. 근데 그게 파티션 jar의 top-level 사이트를 cover하지 않는다. iframe이 `https://example.com`에 있으니까, 거기서 partitioned 쿠키를 쓰려면 `example.com`에 대한 권한이 필요하다.

"해결책"은 `host_permissions: ["<all_urls>"]`. 작동은 한다. 그리고 인스톨 다이얼로그에 **"방문하는 모든 웹사이트의 데이터를 읽고 변경"**이라는 경고가 뜬다. 한 가지 일만 하는 사이드 패널 익스텐션에 이 경고는 잔혹하다. 사용자 절반이 도망간다.

이 신뢰 비용을 정당화할 수 없었다.

## 전환점

문제를 충분히 오래 노려보면 어느 순간 자명한 답이 떠오를 때가 있다 — 우리는 `chrome.cookies`가 애초에 필요 없다. 브라우저는 이미 partitioned 쿠키를 쓰는 법을 안다, 부탁만 잘 하면. 그리고 그 부탁을 위한 표준 cookie attribute가 존재한다.

```http
Set-Cookie: session=…; Partitioned; SameSite=None; Secure; HttpOnly; Path=/
```

[CHIPS](https://developer.chrome.com/docs/privacy-security/privacy-sandbox/chips) — Cookies Having Independent Partitioned State. 이 속성을 붙이면 브라우저가 알아서 iframe의 파티션 jar에 (임베딩 top-level 사이트로 키잉해서) 쿠키를 넣고, 같은 iframe의 후속 요청에 다시 보낸다. `host_permissions` 따위 필요 없다 — 쿠키를 쓰는 주체가 익스텐션이 아니라 *서버*니까.

이게 CHIPS의 본래 디자인이다. 우리가 그걸 우회하려 했던 거였다.

## 2차 시도: 서버 측 Set-Cookie + CHIPS 속성

리디자인은 SW를 얇은 토큰 vendor로 축소한다:

```ts
// SW broker — idToken만 vending, 쿠키도 fetch도 건드리지 않음
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

iframe은 — 임베드돼 있어도 1st-party `commentarium.app` 컨텍스트라는 점이 핵심 — 자기가 직접 `/api/login`을 부른다:

```ts
// iframe (1st-party 컨텍스트)
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
| 인스톨 다이얼로그 | "방문하는 모든 사이트 데이터..." | 최소한 |
| 인증 관련 SW 라인 수 | ~300 (mint, partition registry, cleanup) | ~230 (token vending only) |

`host_permissions` 없음, `cookies` 권한 없음, **더 낮은** Chrome 버전 floor (CHIPS가 우리가 의존했던 partition-key API보다 먼저 나옴), 인스톨 시점에 명시적 보안 경고 하나 줄어듦. SW에서 partition-registry 부기 코드 약 70줄 삭제.

## 보너스: revokeRefreshTokens로 크로스 파티션 로그아웃

`auth.revokeRefreshTokens(uid)`는 사용자의 모든 refresh token을 서버 측에서 무효화한다. 인증 라우트들이 extension surface에서 `verifySessionCookie(cookie, /* checkRevoked */ true)`를 쓰면, 어느 한 파티션에서의 로그아웃이 전파된다 — 다른 파티션의 쿠키는 jar에 물리적으로 남아 있지만 다음 요청에서 검증 실패. UI는 401을 잡아서 `commentarium:signed-out` 커스텀 이벤트로 signed-out 상태로 전환한다. 깔끔.

(의도적으로 빼둔 nuance 하나: 1st-party `commentarium.app`을 직접 방문하는 컨텍스트는 unpartitioned 쿠키와 별개의 sign-in surface를 쓴다. 그래서 익스텐션에서 로그아웃해도 직접 연 `commentarium.app` 탭은 로그아웃되지 않는다. Slack 데스크톱 vs Slack 브라우저와 같은 모델 — 두 surface는 의도적으로 분리.)

## 교훈

1. **Chrome API workaround로 손이 가기 전에 cookie 스펙을 보자.** CHIPS는 정확히 이 케이스 — 임베디드 컨텍스트를 위한 partitioned 쿠키 — 를 위해 존재한다. `chrome.cookies` 문서를 네 번 읽고 나서야 cookie attribute 문서를 처음 읽었다.
2. **Manual E2E는 단위 테스트가 못 잡는 걸 잡는다.** chrome.cookies 실패는 *실제 두 번째 도메인에 호스팅된 실제 페이지에서만* 보였다. 단위 테스트는 통과했다. 브라우저의 권한 체계는 mock으로 너무 쉽게 우회된다.
3. **Service worker는 얇을수록 좋다.** SW가 *ID token만 발급*하는 일만 하면, 깜짝 놀랄 표면적이 줄어든다. 삭제된 라인의 대부분은 파티션 시맨틱에 대한 sample-of-one 가정을 끌고 다니던 코드였다.
4. **CHIPS는 오늘 기준 Chrome / Edge.** Firefox는 구현 중, Safari는 다른 입장. Chrome Web Store용 익스텐션에는 이걸로 충분. 크로스 브라우저 익스텐션이라면 다른 모양이 필요하다.

diff는 압도적으로 우리 편이었다. 가장 어려운 건 첫 번째 디자인이 잘못된 모양이었다는 걸 인정하는 거였다.

---

*코드: [commentarium-extension](https://github.com/zeikar/commentarium-extension). CHIPS 리디자인은 [익스텐션 PR #2](https://github.com/zeikar/commentarium-extension/pull/2) 로 머지됐다.*
