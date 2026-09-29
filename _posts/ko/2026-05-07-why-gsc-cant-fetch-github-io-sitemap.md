---
title: "Google Search Console이 github.io 사이트맵을 못 가져오는 이유"
subtitle: "아티팩트 진단은 전부 초록불이었던 이유, 원인을 두고 가설이 갈리는 이유, 그리고 결국 문제를 해결한 커스텀 도메인."
date: 2026-05-07
translations:
  en: /blog/why-gsc-cant-fetch-github-io-sitemap/
description: "Google Search Console이 github.io 사이트맵에 'Couldn't fetch'를 계속 띄웠다. XML 스키마, Content-Type, Googlebot User-Agent fetch, 스코프 규칙, robots.txt 전부 초록불. 답은 XML과 무관한 커스텀 도메인이었다."
---

망가지지 않은 XML 파일 이야기다. Google Search Console은 내 `sitemap.xml`에 계속 `Couldn't fetch`를 띄웠는데, 내가 돌린 진단은 전부 초록불이었고, 답은 결국 XML과 상관이 없었다.

## 세팅

`zeikar.github.io`는 GitHub Pages 위에서 도는 Jekyll 사이트였다. 루트의 `sitemap.xml`은 사이트맵 *index*였고, 같은 호스트 아래 서브 사이트맵 세 개를 가리켰다:

```xml
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://zeikar.github.io/sitemap-main.xml</loc></sitemap>
  <sitemap><loc>https://zeikar.github.io/backend-interview-guide/sitemap.xml</loc></sitemap>
  <sitemap><loc>https://zeikar.github.io/charivo/sitemap.xml</loc></sitemap>
</sitemapindex>
```

main은 블로그 글과 프로젝트 페이지를 포괄하고, 나머지 두 개는 같은 호스트네임 아래에 별도 GitHub Pages로 배포된 서브 프로젝트의 사이트맵이다.

`https://zeikar.github.io/sitemap.xml`을 Google Search Console에 제출하면, GSC가 인덱스를 읽고 서브 사이트맵을 fetch한 뒤 URL들을 인덱싱 큐에 넣는다. 그게 계획이었다.

실제로 GSC는 며칠 동안 `Couldn't fetch`에서 멈춰 있었다. 재제출도 소용없었다. 기다려도 소용없었다.

## 다섯 번의 초록불

### XML 검증

첫 번째 용의자: 서빙되는 XML 그 자체. GitHub Pages가 실제로 내려주는 바이트에 `xmllint`를 돌려보면 well-formed:

```bash
$ curl -sS https://zeikar.github.io/sitemap.xml | xmllint --noout -; echo $?
0
```

공식 sitemap.org 스키마 검증도 통과:

```bash
$ curl -sS https://zeikar.github.io/sitemap.xml | xmllint --schema siteindex.xsd --noout -
- validates
```

서브 사이트맵 세 개도 `sitemap.xsd`로 검증 통과. 초록불.

### HTTP & Content-Type

GitHub Pages가 잘못된 content type으로 서빙할 가능성. `curl -I`:

```
$ curl -sI https://zeikar.github.io/sitemap.xml | head -3
HTTP/2 200
server: GitHub.com
content-type: application/xml
```

`200 OK`, `application/xml`. 바이트는 `<?xml`로 바로 시작한다. BOM 없음, UTF-8 깔끔. 초록불.

### Googlebot User-Agent

Googlebot이 평소 요청과 다른 응답을 받을 가능성. 기본 UA fetch와 Googlebot UA fetch를 diff:

```bash
$ diff <(curl -sS https://zeikar.github.io/sitemap.xml) \
       <(curl -sSA "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
              https://zeikar.github.io/sitemap.xml)
```

diff는 비어 있다. 바이트까지 똑같다. 초록불.

### 사이트맵 인덱스 스코프 규칙

[사이트맵 인덱스 스펙](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps)은 인덱스에서 참조하는 서브 사이트맵이 인덱스와 같거나 더 깊은 경로에, 그리고 같은 호스트에 있어야 한다고 규정한다. 내 인덱스는 `/sitemap.xml`이라 루트 스코프고, 같은 호스트의 어떤 경로든 OK. 서브 사이트맵 세 개는 모두 `zeikar.github.io` 위에 있고, 두 개는 더 깊은 경로(`/backend-interview-guide/`, `/charivo/`)에 있다. 초록불.

### robots.txt

robots.txt에서 막혀 있으면 다른 게 다 멀쩡해도 소용없다. 내 robots.txt는 오히려 전부 열어 두고 있었다:

```
User-agent: *
Allow: /

Sitemap: https://zeikar.github.io/sitemap.xml
```

`/` 허용에, 사이트맵을 명시적으로 선언. 초록불.

---

정리하면, 아티팩트에 돌린 진단은 전부 깨끗하게 통과했다. XML도 멀쩡. HTTP도 멀쩡. 봇이 접근 가능. 경로 스코프도 규칙대로. robots.txt 허용. 그런데도 GSC는 `Couldn't fetch`라고 했다.

## 패턴

정확한 에러 문구로 검색해보니 몇 년째 같은 보고가 올라와 있었다. GSC가 `*.github.io` 서브도메인의 사이트맵을 자주 못 가져온다는 것이다. 같은 사이트맵을 Bing 같은 다른 인덱서는 멀쩡히 가져간다. 같은 XML을 커스텀 도메인으로 옮기면 즉시 fetch된다. ([Google Search Central 스레드](https://support.google.com/webmasters/thread/352368538), [GitHub community discussion](https://github.com/orgs/community/discussions/149884), [Chirpy 테마 이슈 #2658](https://github.com/cotes2020/jekyll-theme-chirpy/issues/2658), [dev.to 사례](https://dev.to/stankukucka/google-search-console-cant-fetch-sitemap-on-github-pages-31kn).)

공식 설명은 없고, 공개된 스레드들은 서로 다른 커뮤니티 가설로 갈린다. 그중 하나는 위 Chirpy 이슈의 한 contributor가 내놓은 관찰이다. GSC가 *URL prefix property*로 등록한 사이트와 *Domain property*로 등록한 사이트에서 사이트맵 제출을 다르게 처리하는 것 같다는 것. `.github.io` 서브도메인은 apex가 GitHub 소유라 URL prefix property로만 등록할 수 있다. 그 contributor는 GitHub Pages 백엔드는 그대로 두고 본인 소유 도메인으로 옮겨 DNS 인증으로 Domain property를 등록했더니 사이트맵이 바로 제출됐다고 적었다. 다만 Google의 [Search Console API 문서](https://developers.google.com/webmaster-tools/v1/sitemaps/submit)와 [property 종류 안내](https://support.google.com/webmasters/answer/34592)에는 URL prefix property도 사이트맵을 제출할 수 있는 대상으로 나와 있다. 그러니 Domain property가 필요하다는 건 공식 요구조건이 아니라 스레드에서 관찰된 상관관계일 뿐이다.

같은 스레드에는 GitHub Pages가 Google의 자동화 IP 대역에 레이트리밋을 걸거나 차단하고, 그게 Google fetcher 쪽에서 `URL_FETCH_STATUS_MISC_ERROR`로 나타난다는 가설도 있다. GitHub이나 Google 안을 들여다볼 수 없으니 어느 쪽도 확인할 방법은 없다. 분명한 건 경험적 패턴이다. 같은 아티팩트라도 호스트가 다르면 GSC가 완전히 다르게 동작한다.

## 답

그래서 `zeikar.dev`를 사서, GitHub Pages 커스텀 도메인 표준 절차대로 연결했다: apex에 GitHub IP를 가리키는 `A`/`AAAA` 레코드, 레포 루트의 `CNAME` 파일, 그리고 `_config.yml`의 `url: "https://zeikar.dev"`. GSC에 사이트맵을 재제출했다.

GSC가 첫 시도에 fetch했다.

XML 구조는 그대로. Jekyll 빌드와 서브 사이트맵 레이아웃도 그대로. HTTP 헤더도 그대로. 달라진 건 모든 URL 안의 호스트네임뿐이었다. 사이트맵 `<loc>`들과 `robots.txt`의 `Sitemap:` 줄이 `zeikar.github.io`에서 `zeikar.dev`로 바뀐 게 전부다.

## 처음에 해봤어야 할 것

아티팩트 진단이 전부 깨끗하면, 버그는 아티팩트 바깥에 있다. 이럴 때 가장 싼 디버깅은 아티팩트를 더 세게 찔러보는 게 아니라 호스트 같은 주변 환경을 바꿔보는 거다.

XML과 HTTP 헤더 디버깅에 몇 시간을 썼는데, "그냥 호스트네임을 바꿔볼까" 하고 30초만 써 봤어도 답이 나왔을 것이다. [getAuthToken](/blog/ko/from-getauthtoken-to-launchwebauthflow/), [CHIPS](/blog/ko/from-chrome-cookies-to-chips/) 글들과 모양은 다르지만, 같은 부류의 실수다. 엉뚱한 걸 튜닝하고 있었다.
