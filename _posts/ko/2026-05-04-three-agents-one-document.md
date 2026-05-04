---
title: "에이전트 셋, 문서 하나: Claude Code 멀티 에이전트 문서 파이프라인"
subtitle: "한국어 백엔드 면접 가이드를 위한 가벼운 콘텐츠 파이프라인 — 왜 한 에이전트로 다 시키는 대신 writer, reviewer, consistency-checker로 쪼갰는가."
date: 2026-05-04
translations:
  en: /blog/three-agents-one-document/
description: "Claude Code 멀티 에이전트 문서 파이프라인 — backend-interview-guide의 writer/reviewer 분리, 파싱 가능한 Output Contract, self-verification이 못 잡는 걸 잡는 hook."
---

[backend-interview-guide](https://github.com/zeikar/backend-interview-guide) 프로젝트의 에이전트 하네스 이야기다. database, cloud, system-design, programming 카테고리에 걸쳐 약 33개 문서가 있는 한국어 면접 레퍼런스인데, `.claude/` 세팅 자체는 작다 — 에이전트 정의 3개, 오케스트레이터 스킬 하나, hook 하나. 그게 핵심이다. 화려해서 좋은 게 아니라, 각 조각이 특정 실패 모드를 막기 위해 존재하기 때문에 동작이 일관된다.

상식적인 출발점은 한 에이전트가 초안 작성, 자체 리뷰, 인덱스 패치까지 다 하는 거다. 문서 하나일 땐 잘 된다. 문서가 열 개쯤 되면 무너지는데 — 같은 에이전트가 자기 글을 리뷰하면 자기 동의 쪽으로 흐르고, README 인덱스가 조용히 어긋나기 시작하고, 오케스트레이터가 분기할 만한 일관된 출력 형식이 없다.

그래서 하네스는 세 에이전트 — `content-writer`, `content-reviewer`, `consistency-checker` — 를 `interview-guide` 오케스트레이터 스킬이 조율하는 구조다. 이 분리에서 가장 중요했던 결정 세 가지를 풀어본다.

## writer가 자기 글을 리뷰하면 안 된다

`content-writer`와 `content-reviewer`는 대화 상태(conversational state)를 공유하지 않는다 — 저장된 파일이 handoff boundary다. writer가 초안을 쓰고 저장하면, 오케스트레이터가 경로를 받아서 reviewer에게 넘기고, reviewer는 그 파일을 자기 컨텍스트로 새로 읽는다. 초안이 어떻게 만들어졌는지에 대한 기억 없이.

하나로 합치고 싶은 유혹이 있다 — 한 에이전트가 초안을 쓴 다음 자체 점검까지 하면 되지 않나? 안 된다. writer는 자기 초안에 attached돼 있다. 방금 800줄짜리 마크다운을 뱉은 상태에서 "잘못된 부분 찾아라"는 건 자기랑 의견을 달리해 보라는 요구다. 실제론 아무것도 못 찾거나, 사소한 nit만 잡는다. 구조적 결정을 비판한다는 건 자기 구조 선택이 틀렸다고 인정하는 거니까.

reviewer는 파일을 *파일로* 읽는다. 작성 과정에서 뭐가 쉬웠고 어려웠는지 모른다. 내부 변호 없이 기존 문서들과 비교한다. 등급 루브릭이 이걸 명시한다 — 세 단계 (`상`, `중`, `하`)에 가장 위 등급은 이렇게 정의돼 있다:

> **상 (Publish-Ready)** — 기술적 오류 없음 / 트레이드오프 누락 없음 / "왜?" 후속 질문에 답할 수 있는 깊이 / 기존 문서와 동일한 스타일 — 모든 조건을 충족.
>
> **경계선상이면 낮은 쪽으로 판정한다.**

저 마지막 한 줄이 없으면 루브릭은 인플레이션을 일으킨다. `상`의 빡빡한 ALL-clauses는 항목 하나만 봐주면 통과시킬 수 있고, fence case에서 LLM은 더 너그러운 쪽을 고르는 경향이 있다. 동률 판정을 아래로 — `중` (1회 수정) 또는 `하` (전체 재작성) 쪽으로 — 강제로 밀어야 진짜 revision cycle이 돌고, 애매한 초안이 publish-ready로 슬쩍 넘어가지 않는다.

같은 논리가 `consistency-checker`에도 적용된다. 에이전트 정의에는 이런 fence가 박혀 있다:

> 역할 경계: 링크/구조 문제는 직접 수정한다. 콘텐츠 누락은 보고만 한다 (content-writer 영역). consistency-checker가 콘텐츠를 직접 생성하면 content-writer의 스타일 분석, AGENTS.md 준수, 면접 적합성 확보 절차를 우회하게 되어 품질이 보장되지 않는 콘텐츠가 리뷰 없이 추가된다.

저건 문서가 아니라 울타리다. 저 줄이 없으면 — 능력 자체는 충분한 — consistency-checker가 누락 파일을 patch하기 시작한다. 구조 문제처럼 *보이기* 때문에. 사실은 콘텐츠 문제다. 잘못된 에이전트가 고치면 writer의 스타일 발견 단계와 reviewer의 등급 부여 단계를 건너뛰고, 아무도 검증하지 않은 문서가 조용히 늘어난다.

멀티 에이전트 시스템의 무서운 실패 모드는 에이전트들이 서로 의견 충돌하는 게 아니다. 에이전트들이 "효율적으로" 도와주려고 역할 경계를 친절하게 넘는 거다 — 그리고 아무도 검증 안 한 출력물이 결과로 남는다.

## Output Contract: 에이전트 사이의 ABI

오케스트레이터는 reviewer의 등급에 따라 분기한다:

```
IF overall == "하":                              writer 재작성 (max 2 retries)
ELIF overall == "중" AND critical_count > 0:     writer 1회 수정 (재리뷰 없음)
ELIF overall == "중":                            publish; Enhancement 항목만 보고
ELIF overall == "상":                            publish
```

1회 수정 케이스에서 재리뷰를 건너뛰는 건 의도된 거다 — reviewer의 contract에서 critical 항목은 기계적으로 적용 가능할 만큼 구체적이고 (추가할 섹션, 고칠 사실), SubagentStop hook이 저장 시 링크 체커를 다시 돌리니까 구조적 무결성은 reviewer 한 번 더 안 돌려도 보장된다.

이 분기는 오케스트레이터가 자유 형식 리뷰에서 `overall`과 `critical_count`를 안정적으로 뽑아낼 수 있어야만 작동한다. 에이전트한테 "등급을 명확히 표시하라"고 부탁하는 걸로는 부족하다 — Claude는 매번 다른 형식으로 박는다. 어떤 때는 리스트 안에, 어떤 때는 섹션 헤더로, 어떤 때는 그냥 한 문장으로.

그래서 모든 에이전트에 Output Contract가 있다. reviewer의 contract는 사람이 읽을 수 있는 마크다운 안에 기계 파싱 가능한 블록을 박아둔다:

```md
<!-- REVIEW_SUMMARY
overall: 상|중|하
accuracy: 상|중|하
interview_fit: 상|중|하
style: 상|중|하
critical_count: N
-->
```

reviewer는 본문 옆에 이 블록을 채운다. 오케스트레이터는 이걸 파싱한다. `_workspace/{topic}/02_review.md`를 사람이 슥 훑으면 이 블록은 안 보인다 — HTML 주석이라 렌더되지 않는다. 같은 아이디어가 writer의 `Writer Output` 블록(`작업 유형`, `대상 파일`, `줄 수`, `주요 섹션`)과 `consistency-checker`의 `<!-- CONSISTENCY_SUMMARY -->`에도 있다.

"에이전트들끼리 어떻게 통신하나"의 지루한 답은 이거다 — 기계가 파싱할 수 있는 사이드 채널을 주고, 그걸 채우는 걸 에이전트 사양의 일부로 명시한다. 사후 처리도 아니고, 본문에 정규식 돌리는 것도 아니고, 처음부터 spec.

## Hook은 거짓말을 잡는다

모든 에이전트는 Self-Verification 체크리스트를 들고 다닌다. writer의 체크리스트는 9개 항목이다 — front matter 존재 여부, 앵커 링크가 실제 헤딩과 일치하는지, 용어 일관성, README 업데이트 여부 등. 에이전트는 제출 전에 하나씩 체크한다.

체크리스트만으론 부족하다.

에이전트는 "확인했음, 모두 valid"라고 보고하면서 깨진 앵커를 가진 문서를 그대로 ship한다. 악의가 있어서가 아니라 — 보고서의 패턴만 맞추고 실제 검증 단계는 건너뛴다. 에이전트 입장에선 진짜로 확인했다고 *느낀다*. 해법은 보고서를 신뢰하지 않는 거다.

`.claude/settings.json`은 writer와 checker가 끝날 때마다 도는 hook을 걸어둔다:

```json
{
  "hooks": {
    "SubagentStop": [{
      "matcher": "content-writer|consistency-checker",
      "hooks": [{
        "type": "command",
        "command": "python3 scripts/check_markdown_links.py 1>&2 || exit 2",
        "timeout": 30
      }]
    }]
  }
}
```

저 두 에이전트 중 하나가 끝나면 Claude Code가 링크 체커를 실행한다. exit code 2면 에이전트를 hard-fail시킨다. "링크 검증했음" 주장을 *실제로* 검증하는 스크립트가 감독한다. reviewer는 matcher에 없다 — reviewer는 글을 안 쓰니까 검증할 게 없다.

이게 하네스에서 가장 가성비 좋은 reliability 장치다. hook 자체는 15초짜리 파이썬 스크립트인데, 막아주는 버그는 404 링크가 박힌 채 publish되는 일이다.

## Takeaways

1. **역할은 능력이 아니라 attached된 대상으로 분리한다.** writer가 reviewer보다 멍청한 게 아니다. 자기 초안에 매여 있을 뿐이다.
2. **오케스트레이터가 분기에 쓸 거면, 파싱 가능하게 만들어라.** 사람용 자유 형식은 괜찮다. 제어 흐름용은 안 된다. 요약 블록을 박고, 그 블록 채우기를 에이전트 사양에 넣어라.
3. **Self-verification은 코멘트다. Hook은 계약이다.** 9개짜리 체크리스트도 깨진 앵커를 통과시킨다. 15초짜리 스크립트는 안 통과시킨다.
4. **Workspace를 저장하라.** `_workspace/{topic}/`이 있어서 이 글이 가능했다. 없었다면 문서가 어떻게 만들어졌는지의 유일한 기록은 결과물 자체였을 거고, 그걸로는 디버깅도 회고도 안 된다.

하네스는 작다. 에이전트 셋, 오케스트레이터 스킬 하나, hook 하나. 크기가 핵심이 아니다. 핵심은 각 조각이 특정 실패 모드를 닫음으로써 자기 복잡도를 정당화하고, 나머지 시스템이 길을 비켜준다는 거다.

---

*코드: [.claude/](https://github.com/zeikar/backend-interview-guide/tree/main/.claude). 프로젝트: [backend-interview-guide](https://github.com/zeikar/backend-interview-guide).*
