---
title: "Chrome 확장 프로그램 iframe 인증: chrome.cookies에서 CHIPS로"
subtitle: "서드파티 쿠키가 막힌 iframe에 로그인 쿠키를 넣으려고 확장 프로그램이 직접 쿠키를 썼더니, 모든 사이트의 쿠키 권한이 필요했다. 쿠키는 서버가 Partitioned 속성을 붙여 내려주면 됐다."
date: 2026-05-03
unit: commentarium
last_modified_at: 2026-11-18
translations:
  en: /blog/from-chrome-cookies-to-chips/
description: "서드파티 쿠키 차단 환경에서 Chrome 확장 프로그램의 iframe을 로그인시키는 법: chrome.cookies로 파티션 쿠키를 쓸 때의 권한 문제와, 서버가 CHIPS(Partitioned) 쿠키를 내려주는 해결책."
---

[Commentarium](https://commentarium.app)은 아무 URL에나 댓글을 달 수 있는 웹앱이다. [Chrome 확장 프로그램](https://github.com/zeikar/commentarium-extension)은 콘텐츠 스크립트로 모든 페이지에 댓글 패널을 붙이고, 그 안에 `commentarium.app/comments?url=…` iframe을 띄운다. 그러니 iframe은 아무 사이트에나 박힌 `commentarium.app` 페이지, 전형적인 서드파티 컨텍스트다.

Chrome은 시크릿 모드에서 서드파티 쿠키를 기본으로 막고, 일반 창에서도 설정 하나로 막을 수 있다. 막히면 iframe에 세션 쿠키가 안 남아서 로그인이 안 되고, 로그인이 안 되면 댓글도 못 단다. 이 글은 그 iframe에서 로그인이 되게 만든 이야기다.

## chrome.cookies로 파티션 쿠키를 직접 쓰기

처음 구조는 MV3에서 흔히 쓰는 브로커 방식이었다. 서비스 워커가 로그인 상태를 들고 있고, iframe은 `chrome.runtime.sendMessage`로 서비스 워커와 통신한다(`externally_connectable.matches`로 `commentarium.app`만 허용). 로그인하면 서비스 워커가 이렇게 움직였다.

1. `chrome.identity.getAuthToken`과 `signInWithCredential`로 Firebase ID 토큰을 받는다.
2. `Authorization: Bearer <idToken>`을 달아 `/api/login`에 POST한다.
3. 서버가 `{ session, expiresAtSeconds }`를 돌려준다.
4. 서비스 워커가 그 세션 값을 `chrome.cookies.set({ url, name: "session", value, partitionKey })`로 iframe의 쿠키 파티션에 직접 쓴다.

4번이 핵심이었다. 서드파티 쿠키가 막혀도 파티션 쿠키(CHIPS)는 남으니, 서비스 워커가 `chrome.cookies.getPartitionKey`(Chrome 132+)로 iframe의 파티션 키를 알아내서 거기에 쿠키를 넣는다. 단위 테스트는 다 통과했고 localhost에서 눌러 봐도 잘 됐다.

## 파티션 쿠키에는 top-level 사이트 권한이 필요했다

실제 사이트에 띄워 보니 쿠키가 써지지 않았다. 직접 확인해 보니 `chrome.cookies.set`으로 파티션 쿠키를 쓰려면 쿠키의 host(`commentarium.app`)가 아니라 그 파티션의 top-level 사이트에 대한 `host_permissions`가 필요했다. 확장 프로그램에는 `host_permissions: ["https://commentarium.app/*"]`만 있었다. iframe이 `https://example.com`에 떠 있으면 `example.com` 권한이 있어야 하고, 이 확장 프로그램은 모든 사이트에 뜨니 결국 `<all_urls>`가 필요하다.

`<all_urls>`를 넣으면 돌아가긴 한다. 하지만 `cookies` 권한과 모든 사이트의 host 권한을 같이 쥐면, 이 확장 프로그램은 사용자가 로그인한 모든 사이트의 쿠키를 읽고 쓸 수 있게 된다. 댓글 패널 하나 띄우는 확장 프로그램이 가질 권한이 아니고, Chrome 웹 스토어 심사에서도 넓은 host 권한은 따로 따져 본다. 그래서 그 길은 접었다.

## 쿠키는 서버가 Partitioned로 내려준다

돌아보면 `chrome.cookies`는 애초에 필요 없었다. 브라우저는 원래 파티션 쿠키를 쓸 줄 알고, 그걸 요청하는 표준 쿠키 속성이 있다.

```http
Set-Cookie: session=…; Partitioned; SameSite=None; Secure; HttpOnly; Path=/
```

[CHIPS](https://privacysandbox.google.com/cookies/chips)(Cookies Having Independent Partitioned State)다. 이 속성이 붙은 쿠키는 브라우저가 iframe의 파티션(임베딩한 top-level 사이트가 키)에 넣고, 같은 파티션의 다음 요청에 다시 실어 보낸다. 쿠키를 쓰는 주체가 확장 프로그램이 아니라 서버라서 `host_permissions`가 필요 없다.

바꾼 구조에서 서비스 워커는 ID 토큰만 내준다. 로그인 상태가 없으면 정리하고 signed-out을 돌려줄 뿐, 쿠키도 `/api/login` 호출도 하지 않는다. `/api/login`은 iframe이 직접 부른다. iframe은 서드파티 컨텍스트지만, 안의 코드가 `/api/login`을 부르는 건 자기 origin으로 가는 요청이다.

```ts
// iframe 코드
const { idToken } = await broker.refreshSession();
await fetch("/api/login", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${idToken}`,
    "X-Commentarium-Surface": "extension",
  },
});
```

서버는 확장 프로그램에서 온 요청이면 쿠키에 `Partitioned`를 붙인다.

```ts
// /api/login 라우트 핸들러 (줄임)
const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
cookies().set({
  name: "session",
  value: sessionCookie,
  httpOnly: true,
  secure: true,
  sameSite: "none",
  partitioned: isExtensionSurface, // CHIPS는 이 한 줄
});
```

파티션은 top-level 사이트마다 따로라서, 새 사이트에서 패널을 열면 그 파티션에는 아직 쿠키가 없다. 그때 iframe이 서비스 워커에서 토큰을 받아 `/api/login`을 한 번 부르면 그 사이트용 쿠키가 생긴다. 서비스 워커가 여전히 로그인 상태를 들고 있는 이유가 이것이다.

CHIPS는 Chrome 114부터 정식 지원이라, 확장 프로그램의 최소 버전도 `getPartitionKey` 때문에 올렸던 132에서 114로 내려갔다. Firefox는 141부터 지원하고, Safari는 18.4에 넣었다가 뺀 뒤 26.2부터 다시 지원한다. Chrome 웹 스토어용이면 충분하고, 다른 브라우저까지 낼 거라면 [지원 표](https://caniuse.com/mdn-http_headers_set-cookie_partitioned)부터 보는 게 좋다.

## 바뀐 매니페스트

| | chrome.cookies 방식 | CHIPS 방식 |
|---|---|---|
| `permissions` | `activeTab`, `identity`, `storage`, `cookies` | `activeTab`, `identity`, `storage` |
| `host_permissions` | `<all_urls>` 필요 | `https://commentarium.app/*`도 뺐다 |
| `minimum_chrome_version` | `132` (`getPartitionKey`) | `114` (CHIPS) |
| 서비스 워커 인증 코드 (`auth.ts`) | 336줄 | 235줄 |

## 파티션마다 남는 쿠키와 로그아웃

CHIPS에는 대가가 하나 있다. 쿠키가 파티션마다 따로 남으니, 한 사이트에서 로그아웃해도 다른 사이트 파티션의 쿠키는 그대로다. 그래서 로그아웃은 쿠키를 지우는 대신 서버에서 무효화한다. `auth.revokeRefreshTokens(uid)`가 사용자의 refresh token을 모두 무효화하고, 확장 프로그램에서 온 요청은 `verifySessionCookie(cookie, true)`로 무효화 여부까지 확인한다. 다른 파티션에 쿠키가 남아 있어도 다음 요청에서 검증에 실패하고, UI는 401을 받으면 `commentarium:signed-out` 이벤트로 로그아웃 상태로 바뀐다.

`commentarium.app`을 직접 연 탭은 파티션 없는 일반 쿠키를 쓰는 별도의 로그인이다. 웹에서 로그아웃하면 같은 무효화가 일어나서 확장 프로그램도 같이 로그아웃되지만, 확장 프로그램에서 로그아웃해도 직접 연 탭은 그대로다.

CHIPS로 바꾼 작업은 [확장 프로그램 PR #2](https://github.com/zeikar/commentarium-extension/pull/2)로 머지됐다.

*처음 이 글에서는 `<all_urls>`의 비용을 설치 창의 "모든 웹사이트" 경고로 설명했다. 그런데 콘텐츠 스크립트가 이미 모든 사이트에 붙어 있어서 그 경고는 원래부터 떴다. 2026년 11월에 실제 비용인 쿠키 권한 범위로 고쳤다.*
