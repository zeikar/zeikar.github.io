---
title: "Google Search Console이 github.io 사이트맵을 못 가져오는 이유"
subtitle: "사이트맵 파일에 돌린 진단은 전부 통과했는데, GSC가 사이트맵을 가져간 건 커스텀 도메인으로 옮긴 다음이었다."
date: 2026-05-07
last_modified_at: 2026-11-18
translations:
  en: /blog/why-gsc-cant-fetch-github-io-sitemap/
description: "GSC가 github.io 사이트맵에 'Couldn't fetch'를 띄웠다. 스키마, Content-Type, robots.txt는 통과했고, 커스텀 도메인으로 옮기자 바로 가져갔다."
---

`zeikar.github.io`는 GitHub Pages 위에서 도는 Jekyll 사이트였다. 루트의 `sitemap.xml`은 사이트맵 *index*였고, 같은 호스트의 서브 사이트맵 세 개를 가리켰다.

```xml
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://zeikar.github.io/sitemap-main.xml</loc></sitemap>
  <sitemap><loc>https://zeikar.github.io/backend-interview-guide/sitemap.xml</loc></sitemap>
  <sitemap><loc>https://zeikar.github.io/charivo/sitemap.xml</loc></sitemap>
</sitemapindex>
```

main은 이 사이트의 페이지, 블로그 글, 프로젝트 페이지를 담고, 나머지 두 개는 같은 호스트 아래 별도 GitHub Pages로 배포된 프로젝트의 사이트맵이다.

인덱스를 Google Search Console에 제출하면 GSC가 서브 사이트맵을 차례로 가져와 URL을 인덱싱 큐에 넣는다. 그게 계획이었는데, GSC는 며칠 동안 `Couldn't fetch`에서 멈춰 있었다. 다시 제출해도, 기다려도 그대로였다.

## 다섯 번의 초록불

### XML 검증

첫 번째 용의자는 서빙되는 XML 자체였다. GitHub Pages가 실제로 내려주는 바이트에 `xmllint`를 돌리면 well-formed다.

```bash
$ curl -sS https://zeikar.github.io/sitemap.xml | xmllint --noout -; echo $?
0
```

sitemaps.org의 공식 스키마 검증도 통과한다.

```bash
$ curl -sS https://zeikar.github.io/sitemap.xml | xmllint --schema siteindex.xsd --noout -
- validates
```

서브 사이트맵 세 개도 `sitemap.xsd`로 검증을 통과했다.

### HTTP 응답과 Content-Type

GitHub Pages가 엉뚱한 content type으로 내려줄 가능성도 봤다.

```
$ curl -sI https://zeikar.github.io/sitemap.xml | head -3
HTTP/2 200
server: GitHub.com
content-type: application/xml
```

`200`에 `application/xml`이다. 바이트는 `<?xml`로 바로 시작하고, BOM 없는 UTF-8이다.

### Googlebot User-Agent

Googlebot에게만 다른 응답이 갈 수도 있으니, 기본 UA로 받은 것과 Googlebot UA로 받은 것을 diff했다.

```bash
$ diff <(curl -sS https://zeikar.github.io/sitemap.xml) \
       <(curl -sSA "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
              https://zeikar.github.io/sitemap.xml)
```

diff는 비어 있었다. 바이트까지 같다.

### 사이트맵 인덱스 스코프 규칙

Google의 [사이트맵 인덱스 문서](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps)에 따르면 인덱스가 가리키는 사이트맵은 인덱스와 같은 사이트에, 인덱스와 같은 디렉터리나 그보다 깊은 곳에 있어야 한다. 내 인덱스는 `/sitemap.xml`이라 루트 스코프고, 서브 사이트맵 세 개는 모두 `zeikar.github.io` 위에 있다. 두 개는 더 깊은 경로(`/backend-interview-guide/`, `/charivo/`)다.

### robots.txt

robots.txt에서 막혀 있으면 나머지가 다 멀쩡해도 소용없다. 내 robots.txt는 오히려 전부 열어 두고 사이트맵까지 선언하고 있었다.

```
User-agent: *
Allow: /

Sitemap: https://zeikar.github.io/sitemap.xml
```

막판에는 서브 사이트맵 세 개도 `Sitemap:` 줄로 직접 적어 넣었다.

다섯 개 모두 통과했다. 그래도 GSC는 `Couldn't fetch`였다.

## github.io에서만 생기는 문제

정확한 에러 문구로 검색하니 2021년부터 올해까지 같은 보고가 이어지고 있었다. GSC가 `*.github.io` 사이트맵을 못 가져오고, 여러 사람이 커스텀 도메인으로 옮기자 바로 됐다고 적었다. 같은 파일을 Bing Webmaster Tools는 받았다는 보고도 있다. ([Google Search Central 스레드](https://support.google.com/webmasters/thread/352368538), [GitHub community discussion](https://github.com/orgs/community/discussions/149884), [Chirpy 테마 이슈 #2658](https://github.com/cotes2020/jekyll-theme-chirpy/issues/2658), [dev.to 사례](https://dev.to/stankukucka/google-search-console-cant-fetch-sitemap-on-github-pages-31kn))

공식 설명은 없고, 원인을 두고는 추측이 갈린다. Chirpy 이슈의 한 댓글은 Google이 자기가 소유하지 않은 도메인의 사이트맵은 받지 않는 것 같다고 봤다. 그 사람은 도메인을 사서 DNS로 Domain property를 인증했고, GitHub Pages는 그대로 둔 채 사이트맵이 바로 제출됐다고 한다. `.github.io`는 apex가 GitHub 소유라 DNS 인증을 할 수 없으니 URL prefix property로만 등록된다. 다만 Google의 [Search Console API 문서](https://developers.google.com/webmaster-tools/v1/sitemaps/submit)와 [property 안내](https://support.google.com/webmasters/answer/34592)를 보면 URL prefix property도 사이트맵을 제출할 수 있다. Domain property가 필요하다는 건 공식 요구조건이 아니라 스레드에서 본 상관관계일 뿐이다.

GitHub community 토론에는 GitHub 서버가 Googlebot을 포함한 자동화 접근을 막고, 그게 `URL_FETCH_STATUS_MISC_ERROR`로 나타난다는 댓글이 있다. 내 Googlebot 테스트는 User-Agent만 바꾼 것이라 IP로 막는 경우는 걸러내지 못한다. 반대로 도메인이 있어도 해결되지 않았다거나, Cloudflare Pages로 옮겨도 같았다는 댓글도 있다. GitHub이나 Google 안을 들여다볼 수 없으니 어느 쪽도 확인할 방법은 없다. 분명한 건 이 파일에 돌릴 진단은 바닥났고, 남은 변수는 파일 바깥의 호스트라는 것이었다.

## 커스텀 도메인

그래서 `zeikar.dev`를 사서 GitHub Pages 커스텀 도메인 표준 절차대로 연결했다. apex에 GitHub IP를 가리키는 `A`/`AAAA` 레코드를 걸고, 레포 루트에 `CNAME` 파일을 두고, `_config.yml`의 `url`을 `https://zeikar.dev`로 바꿨다. 그리고 GSC에 사이트맵을 다시 제출했다.

GSC는 첫 시도에 가져갔다.

XML 구조도, Jekyll 빌드와 서브 사이트맵 구성도, HTTP 헤더도 그대로였다. 바뀐 건 URL 안의 호스트네임뿐이다. 사이트맵의 `<loc>`와 robots.txt의 `Sitemap:` 줄 네 개에서 `zeikar.github.io`가 `zeikar.dev`가 됐다.
