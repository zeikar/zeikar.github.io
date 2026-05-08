---
title: "Open Graph 이미지 만드는 세 가지 방법, 그리고 내가 만든 한 가지"
subtitle: "손으로 만든 PNG, vercel/og-image 같은 param-driven 서비스, 그리고 @vercel/og 위에 얹은 URL-driven 생성기 — 왜 세 번째가 살아남았는가."
date: 2026-05-09
translations:
  en: /blog/three-ways-to-make-og-images/
description: "Open Graph 이미지 자동 생성의 세 가지 접근 — 손 디자인 PNG, param-driven 서비스, 그리고 @vercel/og 기반 URL-driven 생성기 dogimg."
---

이 링크를 누르기 전에 본 OG 카드 — Slack이나 Twitter, Facebook에 이 URL을 붙였다면 떴을 그 미리보기 — 는 내가 그린 게 아니다. [dogimg](https://dogimg.vercel.app)가 생성했다. 이 사이트의 OG 이미지를 만드는 방법을 세 번 다른 방향으로 시도했고, 그중 실제로 글을 계속 써도 살아남은 건 하나뿐이라 만들게 된 작은 서비스다.

이 글은 그 세 가지 접근을 순서대로 짚고, 왜 URL-driven 생성이 이겼는지에 대한 글이다.

## 1단계: Figma에서 OG 이미지 손으로 만들기

zeikar.dev의 첫 OG 이미지는 1200×630 PNG였다. Figma에서 만들고, export하고, 레포에 끌어다 놓았다. 괜찮아 보였다.

페이지가 하나일 때는 괜찮았다. 세 번째 글을 쓸 즈음에는 미래가 보였다 — 글이 늘어날 때마다 Figma 파일 하나, export 한 번, drag-in 한 번. 사이트의 brand color나 favicon이 바뀌면 이미 배포된 OG 이미지들은 전부 시각적으로 낡은 것이 된다.

솔직한 문제 정의: OG 이미지는 페이지에 이미 존재하는 메타데이터를 시각화한 포스터다. `<title>`, description, theme color, favicon. 브라우저가 렌더링하기 위해 이미 다 거기 있다. OG 이미지를 손으로 디자인한다는 건 같은 콘텐츠를 두 번 쓰는 일이다 — 한 번은 페이지를 위해, 한 번은 포스터를 위해.

## 2단계: param-driven 생성기 (vercel/og-image 류)

다음으로 도착한 곳은 `@vercel/og` 스타일 서비스였다. 콘텐츠를 query parameter로 넘겨서 호출하는 방식이다:

```
https://og-generator.example/api/og?title=My+Post&description=...&theme=teal
```

[`vercel/og-image`](https://github.com/vercel/og-image)가 대표적인 예시다. 이미지가 동적으로 생성되고, 템플릿 레이아웃이 적용되며, 레포에 PNG를 안 들고 있어도 된다. Figma 단계보다는 분명한 진전이다.

하지만 책임은 사실 옮겨가지 않았다. 글을 쓸 때마다 *무언가*가 글의 메타데이터를 query string으로 packing해야 한다. 직접 손으로 하든, 빌드 단계에서 front matter를 읽어 title과 description을 인코딩해 올바른 param이 박힌 URL을 뱉어내든. 페이지는 이미 자기 title을 안다. 플러그인이 그걸 읽는다. 플러그인이 다시 인코딩한다. 서비스가 받아서 렌더링한다. 이미지 하나에 같은 문자열이 세 번 복사되는 셈이다.

내 머릿속에 자리잡은 프레임은 이거였다 — **URL-as-template**. URL은 채워야 할 템플릿이고, 채우는 일은 호출자 몫이다.

## 3단계: URL-driven 생성기 (dogimg)

[dogimg](/projects/dogimg/)는 그다음 질문에서 떨어져 나왔다 — 왜 호출자가 메타데이터를 packing하고 있는가? 페이지는 이미 `<title>`, `<meta name="description">`, `<meta property="og:*">`, `<meta name="theme-color">`, favicon link가 다 박힌 HTML 문서를 서빙하고 있다. 그게 진실의 출처다. 그 페이지에 직접 물어보면 안 되나?

API는 파라미터 하나다:

```
https://dogimg.vercel.app/api/og?url={URL}
```

내부 동작은 세 단계:

1. `{URL}`에서 HTML을 fetch.
2. 문서에서 `og:*`, `twitter:*`, `<title>`, `<meta name="theme-color">`, favicon을 파싱.
3. [`@vercel/og`](https://vercel.com/docs/functions/og-image-generation)로 1200×630 PNG를 렌더 — 페이지의 theme color를 gradient 액센트로, favicon을 카드 아이콘으로 사용.

이 단계의 프레임은 **URL-as-truth**다. 호출자는 아무것도 packing하지 않는다. 페이지는 이미 자기에 대해 알고 있고, dogimg는 그 페이지에 직접 묻는다. 글의 title이 바뀌면 OG 이미지도 바뀐다 — 생성기 재배포도, PNG 재생성도, 심지어 신경 쓰는 것조차 필요 없이.

HTML로는 태그 한 줄이다:

```html
<meta property="og:image" content="https://dogimg.vercel.app/api/og?url=https://your-site.com/post" />
```

소비자 입장에서의 통합은 이게 전부다.

## 결과: Jekyll 플러그인 하나로 모든 페이지 커버

zeikar.dev에서는 빌드 타임에 [_plugins/og_image.rb](https://github.com/zeikar/zeikar.github.io/blob/main/_plugins/og_image.rb)가 이걸 묶어준다. `post_read` 훅에서, front matter에 `image:`를 명시하지 않은 모든 document와 default 레이아웃 페이지에 대해 `page.image`를 dogimg URL로 설정한다:

```ruby
encoded = CGI.escape(base + item.url)
item.data["image"] = "https://dogimg.vercel.app/api/og?url=#{encoded}"
```

커버리지는 `site.documents`(posts와 모든 컬렉션 — `_projects/*.md`도 자동으로 포함)와 `layout: default`로 필터링된 `site.pages`에서 자연스럽게 떨어진다. 그러면 `jekyll-seo-tag`가 `page.image`를 받아 `og:image`와 `twitter:image`를 각각 한 번씩만 emit한다. 중복 없음.

글 쓰기는 그냥 글 쓰기다. OG 단계라는 게 없다. 이 링크를 누르기 전에 본 카드가 그 증거다 — 사이트의 다른 모든 페이지와 같은 경로로 만들어졌다.
