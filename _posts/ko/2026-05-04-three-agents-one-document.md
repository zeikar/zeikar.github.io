---
title: "에이전트 셋, 문서 하나: Claude Code 멀티 에이전트 문서 파이프라인"
subtitle: "한국어 백엔드 면접 가이드용 가벼운 콘텐츠 파이프라인. 에이전트 하나에 다 시키지 않고 writer, reviewer, consistency-checker로 쪼갠 이유."
date: 2026-05-04
translations:
  en: /blog/three-agents-one-document/
description: "Claude Code 멀티 에이전트 문서 파이프라인: backend-interview-guide의 writer/reviewer 분리, 파싱 가능한 Output Contract, self-verification이 못 잡는 걸 잡는 hook."
---

[backend-interview-guide](https://github.com/zeikar/backend-interview-guide) 프로젝트의 에이전트 하네스 이야기다. database, cloud, system-design, programming 카테고리에 걸쳐 약 33개 문서가 있는 한국어 면접 레퍼런스인데, `.claude/` 세팅 자체는 작다. 에이전트 정의 3개, 오케스트레이터 스킬 하나, hook 하나. 화려하진 않아도 조각마다 막으려는 실패 모드가 하나씩 있어서 동작이 일관된다.

보통은 에이전트 하나에 초안 작성, 자체 리뷰, 인덱스 패치까지 다 시키는 데서 시작한다. 문서 하나일 땐 잘 된다. 문서가 열 개쯤 되면 무너진다. 같은 에이전트가 자기 글을 리뷰하면 후해지고, README 인덱스는 어느새 어긋나 있고, 출력 형식이 매번 달라서 오케스트레이터가 분기할 근거가 없다.

그래서 하네스는 `interview-guide` 오케스트레이터 스킬이 에이전트 셋(`content-writer`, `content-reviewer`, `consistency-checker`)을 조율하는 구조다. 이 분리에서 가장 중요했던 결정 세 가지를 풀어본다.

## writer가 자기 글을 리뷰하면 안 된다

`content-writer`와 `content-reviewer`는 대화 상태를 공유하지 않는다. 둘 사이에 오가는 건 저장된 파일뿐이다. writer가 초안을 쓰고 저장하면, 오케스트레이터가 경로를 받아서 reviewer에게 넘기고, reviewer는 그 파일을 자기 컨텍스트에서 새로 읽는다. 초안이 어떻게 만들어졌는지는 모른다.

한 에이전트가 초안을 쓴 다음 자체 점검까지 하면 되지 않나 싶지만, 안 된다. writer는 자기 초안에 매여 있다. 방금 800줄짜리 마크다운을 뱉은 에이전트한테 "잘못된 부분 찾아라"는 건 자기 말을 스스로 뒤집으라는 요구다. 실제론 아무것도 못 찾거나, 사소한 것만 잡는다. 구조적 결정을 비판하려면 자기 구조 선택이 틀렸다고 인정해야 하니까.

reviewer에게 초안은 그냥 파일이다. 작성 과정에서 뭐가 쉬웠고 어려웠는지 모르니, 감쌀 이유 없이 기존 문서들과 비교한다. 등급 루브릭은 세 단계(`상`, `중`, `하`)이고, 가장 위 등급은 이렇게 정의돼 있다:

> **상 (Publish-Ready)**: 기술적 오류 없음 / 트레이드오프 누락 없음 / "왜?" 후속 질문에 답할 수 있는 깊이 / 기존 문서와 동일한 스타일. 모든 조건을 충족.
>
> **경계선상이면 낮은 쪽으로 판정한다.**

저 마지막 한 줄이 없으면 등급이 부풀려진다. `상`은 모든 조건을 채워야 하지만 하나쯤 눈감아 주면 통과시킬 수 있고, 판정이 갈릴 때 LLM은 너그러운 쪽을 고르는 경향이 있다. 경계선상이면 `중`(1회 수정)이나 `하`(전체 재작성)로 내려야 수정 사이클이 제대로 돌고, 애매한 초안이 publish-ready로 슬쩍 넘어가지 않는다.

`consistency-checker`도 마찬가지다. 에이전트 정의에 이런 울타리를 쳐 뒀다:

> 역할 경계: 링크/구조 문제는 직접 수정한다. 콘텐츠 누락은 보고만 한다 (content-writer 영역). consistency-checker가 콘텐츠를 직접 생성하면 content-writer의 스타일 분석, AGENTS.md 준수, 면접 적합성 확보 절차를 우회하게 되어 품질이 보장되지 않는 콘텐츠가 리뷰 없이 추가된다.

저 줄이 없으면 능력은 충분한 consistency-checker가 누락 파일을 직접 채우기 시작한다. 구조 문제처럼 보이기 때문이다. 사실은 콘텐츠 문제다. 엉뚱한 에이전트가 고치면 writer의 스타일 분석 단계와 reviewer의 등급 판정 단계를 건너뛰고, 아무도 검증하지 않은 문서가 슬금슬금 늘어난다.

멀티 에이전트 시스템에서 무서운 건 에이전트끼리 의견이 부딪히는 게 아니다. "효율적으로" 도와주겠다고 역할 경계를 친절하게 넘는 거다.

## Output Contract: 에이전트 사이의 ABI

오케스트레이터는 reviewer의 등급에 따라 분기한다:

```
IF overall == "하":                              writer 재작성 (max 2 retries)
ELIF overall == "중" AND critical_count > 0:     writer 1회 수정 (재리뷰 없음)
ELIF overall == "중":                            publish; Enhancement 항목만 보고
ELIF overall == "상":                            publish
```

1회 수정 케이스에선 일부러 재리뷰를 건너뛴다. reviewer가 이미 패치를 구체적으로 정해 놔서 다시 판단할 것 없이 적용만 하면 되고, writer가 끝나면 SubagentStop hook이 링크 체커를 다시 돌려 깨진 구조를 잡는다.

이 분기는 오케스트레이터가 자유 형식 리뷰에서 `overall`과 `critical_count`를 안정적으로 뽑아낼 수 있어야만 작동한다. 에이전트한테 "등급을 명확히 표시하라"고 부탁하는 걸로는 부족하다. Claude는 매번 다른 형식으로 쓴다. 어떤 때는 리스트 안에, 어떤 때는 섹션 헤더로, 어떤 때는 그냥 한 문장으로.

그래서 모든 에이전트에 Output Contract가 있다. reviewer의 contract는 사람이 읽는 마크다운 안에 기계가 파싱할 블록을 넣게 한다:

```md
<!-- REVIEW_SUMMARY
overall: 상|중|하
accuracy: 상|중|하
interview_fit: 상|중|하
style: 상|중|하
critical_count: N
-->
```

reviewer는 본문과 함께 이 블록을 채우고, 오케스트레이터는 이걸 파싱한다. HTML 주석이라 렌더되지 않으니 `_workspace/{topic}/02_review.md`를 사람이 슥 훑을 땐 안 보인다. writer의 `Writer Output` 블록(`작업 유형`, `대상 파일`, `줄 수`, `주요 섹션`)과 `consistency-checker`의 `<!-- CONSISTENCY_SUMMARY -->`도 같은 방식이다.

에이전트끼리 어떻게 통신하냐고 물으면 답은 따분하다. 기계가 파싱할 사이드 채널을 두고, 그걸 채우는 걸 처음부터 에이전트 사양에 적어 둔다.

## Hook은 거짓말을 잡는다

모든 에이전트는 Self-Verification 체크리스트를 들고 다닌다. writer의 체크리스트는 9개 항목이다. front matter가 있는지, 앵커 링크가 실제 헤딩과 맞는지, 용어가 일관적인지, README를 업데이트했는지 등. 에이전트는 제출 전에 하나씩 체크한다.

체크리스트만으론 부족하다.

에이전트는 "확인했음, 모두 valid"라고 보고하면서 앵커가 깨진 문서를 그대로 내보낸다. 악의가 있어서가 아니다. 보고서 모양만 맞추고 실제 검증 단계는 건너뛴다. 에이전트 입장에선 진짜로 확인했다고 느낀다. 그러니 보고서를 믿지 않는 수밖에 없다.

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

저 두 에이전트 중 하나가 끝나면 Claude Code가 링크 체커를 실행한다. exit code 2면 에이전트는 멈추지 못하고, stderr로 돌아온 체커 출력을 보고 링크부터 고쳐야 한다. "링크 검증했음"이라는 주장을 스크립트가 실제로 검증하는 셈이다. reviewer는 matcher에 없다. 글을 안 쓰니까 검증할 게 없다.

이게 하네스에서 가장 가성비 좋은 안전장치다. hook 자체는 15초짜리 파이썬 스크립트인데, 404 링크가 박힌 채 publish되는 사고를 막아준다.

## 교훈

1. **역할은 능력이 아니라 무엇에 매여 있느냐로 나눈다.** writer가 reviewer보다 멍청한 게 아니다. 자기 초안에 매여 있을 뿐이다.
2. **오케스트레이터가 분기에 쓸 거면, 파싱 가능하게 만들어라.** 사람이 읽을 거라면 자유 형식도 괜찮다. 제어 흐름에 쓸 거라면 안 된다. 요약 블록을 넣고, 그 블록 채우기를 에이전트 사양에 적어라.
3. **Self-verification은 보고일 뿐이고, 검사는 hook이 한다.** 9개짜리 체크리스트는 깨진 앵커를 놓쳐도 15초짜리 스크립트는 못 놓친다.
4. **Workspace를 저장하라.** `_workspace/{topic}/`이 있어서 이 글을 쓸 수 있었다. 없었다면 문서가 어떻게 만들어졌는지 보여 줄 기록은 결과물뿐이었을 거고, 그걸로는 디버깅도 회고도 못 한다.

하네스는 작다. 에이전트 셋, 오케스트레이터 스킬 하나, hook 하나. 중요한 건 크기가 아니다. 조각마다 실패 모드를 하나씩 막아서 제 몫을 하고, 나머지 시스템은 거기에 끼어들지 않는다.

---

*코드: [.claude/](https://github.com/zeikar/backend-interview-guide/tree/main/.claude). 프로젝트: [backend-interview-guide](https://github.com/zeikar/backend-interview-guide).*
