---
title: "Open Graph 이미지 만드는 세 가지 방법, 그중 내가 만든 하나"
subtitle: "페이지가 이미 가진 title과 theme color를 다시 적지 않으려고, URL 하나만 받는 생성기를 만들었다."
date: 2026-05-09
unit: dogimg
last_modified_at: 2026-11-18
translations:
  en: /blog/three-ways-to-make-og-images/
description: "Open Graph 이미지를 만드는 세 가지 방법(손으로 그린 PNG, 파라미터로 내용을 받는 생성기, 페이지 URL만 받는 생성기 dogimg)과 각각의 대가를 비교한다."
---

이 글 링크를 Slack이나 X에 붙이면 뜨는 미리보기 카드는 내가 그린 게 아니다. 2023년에 만든 [dogimg](https://dogimg.vercel.app)가 이 페이지를 읽고 그린다. Open Graph 이미지를 만드는 방법은 크게 세 가지가 있고, dogimg는 그중 세 번째를 따른다. 세 방법이 각각 무엇을 사람 손에 남기는지 순서대로 짚어 본다.

## 손으로 그린 PNG

가장 단순한 방법은 Figma 같은 도구로 1200×630 PNG를 그려서 페이지마다 `og:image`로 거는 것이다. 페이지가 몇 개 안 되면 이걸로 충분하다.

글이 늘면 글마다 그리고, 내보내고, 레포에 넣는 일이 붙는다. 사이트의 브랜드 색이나 파비콘을 바꾸면 이미 나간 이미지는 전부 옛 모습으로 남는다.

게다가 OG 이미지에 들어가는 내용은 대부분 페이지에 이미 있다. `<title>`, description, theme color, 파비콘. 브라우저와 크롤러가 읽으라고 넣어 둔 값이다. 이미지를 손으로 그리면 같은 내용을 페이지에 한 번, 이미지에 한 번, 두 번 쓰게 된다.

## 파라미터로 내용을 받는 생성기

다음은 내용을 query parameter로 넘기면 이미지를 그려 주는 서비스다.

```
https://og-generator.example/api/og?title=My+Post&description=...&theme=teal
```

대표적인 예가 Vercel의 [`vercel/og-image`](https://github.com/vercel/og-image)였다(지금은 보관된 저장소다). 이미지는 요청이 올 때 템플릿에 맞춰 그려지니 레포에 PNG를 둘 필요가 없다. 손으로 그리는 것보다는 확실히 낫다.

그래도 메타데이터를 옮기는 일은 그대로 남는다. 글마다 누군가는 제목과 설명을 query string에 담아야 한다. 손으로 하든, 빌드 단계에서 front matter를 읽어 URL을 만들든 마찬가지다. 페이지는 자기 제목을 이미 아는데, 빌드 단계가 그 제목을 읽어 다시 인코딩하고 서비스가 받아서 그린다. 이 방식에서 URL은 호출하는 쪽이 채워야 하는 템플릿이다.

## 페이지 URL만 받는 생성기, dogimg

[dogimg](/projects/dogimg/)는 채우는 일까지 없앤다. 페이지는 이미 `<title>`, `<meta name="description">`, `og:*` 태그, `theme-color`, 파비콘 링크가 든 HTML을 내려주고 있다. 호출하는 쪽이 그 내용을 옮길 필요 없이, 생성기가 페이지에 직접 물어보면 된다.

그래서 API의 파라미터는 하나다.

```
https://dogimg.vercel.app/api/og?url={URL}
```

요청이 오면 dogimg는 이렇게 움직인다.

1. `{URL}`의 HTML을 가져온다.
2. 제목(`og:title`, 없으면 `<title>`), 설명(`og:description`, `twitter:description`, `description` 순), 사이트 이름, `theme-color`, 가장 큰 파비콘을 읽는다.
3. `next/og`로 1200×630 PNG를 그린다. 파비콘은 카드 위쪽의 아이콘이 되고, theme color는 카드 오른쪽에 번지는 색이 된다. theme color가 없거나 회색이면 파비콘의 주된 색을 대신 쓴다.

처음에는 `@vercel/og`로 그렸고, 지금은 Next.js에 들어 있는 같은 렌더러를 `next/og`로 불러 쓴다. 쓰는 쪽에서 할 일은 태그 한 줄이다.

```html
<meta property="og:image" content="https://dogimg.vercel.app/api/og?url=https://your-site.com/post" />
```

글 제목을 고쳐도 생성기를 다시 배포하거나 PNG를 다시 만들 필요가 없다. 다음에 카드를 그릴 때 dogimg가 바뀐 제목을 읽는다.

## 이 사이트의 Jekyll 플러그인

zeikar.dev에서는 빌드할 때 [_plugins/og_image.rb](https://github.com/zeikar/zeikar.github.io/blob/main/_plugins/og_image.rb)가 이 URL을 채운다. `post_read` 훅에서, front matter에 `image:`가 없는 문서마다 `page.image`를 dogimg URL로 채운다.

```ruby
encoded = CGI.escape(base + item.url)
item.data["image"] = "https://dogimg.vercel.app/api/og?url=#{encoded}"
```

대상은 `site.documents`(글과 `_projects/*.md`를 포함한 모든 컬렉션 문서)와 `layout: default`인 `site.pages`다. `jekyll-seo-tag`가 `page.image`를 받아 `og:image`와 `twitter:image`를 한 번씩 출력한다.

처음 붙였을 때는 레이아웃이 `og:image` 태그를 직접 찍었다. 그런데 `jekyll-seo-tag`는 이미지가 없는 페이지에 `twitter:card`를 `summary`로 내보내서, 레이아웃이 넣은 `summary_large_image`와 함께 태그가 두 개가 됐다. 첫 값을 읽는 크롤러는 큰 카드 대신 작은 카드를 보여 준다. 플러그인이 `page.image`를 미리 채워 두면 `jekyll-seo-tag`가 `summary_large_image`를 한 번만 낸다. 글을 쓸 때 OG 이미지 때문에 따로 할 일은 없다.

## URL만 받는 방식의 대가

손이 가는 일이 없어진 대신, 카드는 요청이 올 때 남의 서버에서 그려진다. 그래서 생기는 비용이 있다.

카드는 바로 바뀌지 않는다. dogimg는 카드를 CDN에 하루 동안 캐시하고, Slack이나 Facebook 같은 서비스도 한 번 가져온 미리보기를 따로 캐시한다. 제목을 고친 뒤 카드가 따라오기까지 시간이 걸린다. 배포 전에 카드를 미리 볼 수도 없다. dogimg는 `localhost` 같은 사설 주소를 거절하니, 페이지가 공개 URL에 올라간 뒤에야 카드가 나온다.

페이지를 읽지 못하면 호스트 이름만 적힌 기본 카드가 나간다. 이 카드는 5분만 캐시돼서 다음 요청에서 다시 시도한다. 호스팅된 dogimg는 가동을 보장하지 않는 공용 인스턴스라, 직접 띄우고 싶으면 README의 Vercel 배포 버튼을 쓰면 된다.

미리보기 말고 화면에 카드를 띄우면 렌더 비용이 방문자에게 간다. 이 사이트에서 실제로 그랬다. 프로젝트 두 개에 `image:`가 없어서 플러그인이 채운 dogimg URL이 홈의 프로젝트 카드 이미지로 쓰였고, 방문할 때마다 카드 하나에 200KB 남짓, 1~1.7초씩 렌더를 기다렸다. 그 둘은 당시 dogimg가 그린 카드를 정적 PNG로 저장해 `image:`에 넣었다. 지금은 프로젝트 32개 모두 자기 PNG가 있어서 플러그인이 건너뛰고, dogimg 카드를 쓰는 건 글과 상위 페이지뿐이다.

*처음 이 글은 이 사이트에서 손으로 그린 PNG와 파라미터 방식 생성기를 차례로 써 본 끝에 dogimg를 만든 것처럼 썼다. 실제로 dogimg는 이 사이트보다 먼저인 2023년에 만들었고, 이 사이트는 첫 글부터 dogimg를 썼다. 2026년 11월에 그 순서를 바로잡고 대가 섹션을 더했다.*
