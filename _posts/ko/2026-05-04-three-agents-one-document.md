---
title: "에이전트 셋, 문서 하나: Claude Code 멀티 에이전트 문서 파이프라인"
subtitle: "면접 가이드 문서를 쓰는 에이전트와 평가하는 에이전트를 나누고 파싱 가능한 요약 블록과 hook으로 묶었는데, 남은 리뷰 기록을 보니 등급은 그래도 후했다."
date: 2026-05-04
unit: backend-interview-guide
last_modified_at: 2026-11-18
translations:
  en: /blog/three-agents-one-document/
description: "backend-interview-guide의 멀티 에이전트 문서 파이프라인: writer/reviewer 분리, Output Contract, 검증이 못 잡는 걸 잡는 hook."
---

[backend-interview-guide](https://github.com/zeikar/backend-interview-guide)는 database, cloud, system-design, programming 네 카테고리에 문서 69개가 있는 한국어 백엔드 면접 레퍼런스다. 2024년에 쓴 문서 18개로 시작했고, 2026년 4월에 Claude Code 하네스부터 만든 다음 닷새 동안 기존 문서를 다시 쓰고 나머지를 채웠다. `.claude/` 세팅은 작다. 에이전트 정의 3개, 스킬 4개(오케스트레이터 `interview-guide`와 에이전트별 하나씩), hook 하나. 조각마다 막으려는 실패가 하나씩 있다.

에이전트 하나에 초안, 자체 리뷰, README 목차 갱신까지 다 맡기면 세 군데서 샌다. 자기 글을 리뷰하면 후해지고, 목차는 조용히 어긋나고, 출력 형식이 매번 달라서 오케스트레이터가 분기할 근거가 없다. 그래서 `interview-guide`가 에이전트 셋(`content-writer`, `content-reviewer`, `consistency-checker`)을 조율하게 했다. 이 분리에서 중요했던 결정 세 가지를 풀어본다.

## writer가 자기 글을 리뷰하면 안 된다

`content-writer`와 `content-reviewer`는 대화 상태를 공유하지 않는다. 둘 사이에 오가는 건 저장된 파일뿐이다. writer가 초안을 쓰고 저장하면, 오케스트레이터가 경로를 받아서 reviewer에게 넘기고, reviewer는 그 파일을 자기 컨텍스트에서 새로 읽는다. 초안이 어떻게 만들어졌는지는 모른다.

한 에이전트가 초안을 쓴 다음 자체 점검까지 하면 되지 않나 싶지만, 안 된다. writer는 자기 초안에 매여 있다. 방금 300줄 넘는 마크다운을 뱉은 에이전트한테 잘못된 곳을 찾으라는 건 자기 말을 스스로 뒤집으라는 요구다. 실제론 아무것도 못 찾거나 사소한 것만 잡는다. 구조를 비판하려면 자기가 고른 구조가 틀렸다고 인정해야 하니까.

reviewer에게 초안은 그냥 파일이다. 작성 과정에서 뭐가 쉬웠고 어려웠는지 모르니 감쌀 이유가 없고, 같은 카테고리에서 가장 긴 문서 두 개를 기준으로 삼아 비교한다. 등급은 `상`, `중`, `하` 세 단계다. `상`은 기술적 오류 없음, 개념에서 실무 시나리오까지 이어지는 흐름, "왜?" 후속 질문에 답할 깊이, 기존 문서와 같은 스타일, Writing Tips 준수를 모두 채워야 한다. 그리고 에이전트 정의의 Failure Modes에 이 줄이 있다.

```
IF 등급 판정이 경계선상이다 (상/중 또는 중/하):
  → 낮은 쪽으로 판정한다. 의심스러우면 보수적으로.
```

이 줄이 없으면 등급이 부풀려진다. `상`은 조건을 전부 채워야 하지만 하나쯤 눈감아 주면 통과시킬 수 있고, 판정이 갈릴 때 LLM은 너그러운 쪽을 고르는 경향이 있다. 경계선이면 `중`(1회 수정)이나 `하`(재작성)로 내려야 수정 사이클이 돈다.

그런데 이 줄로 충분하지는 않았다. `_workspace/`에 남은 리뷰 보고서 18건 중 16건이 `상`이고 `하`는 한 건도 없다. 4월 7일에는 Kafka, 멱등성, 동시성 제어 문서 세 개를 GPT-5.4로 한 번 더 리뷰시켰다. 기본 reviewer가 Critical 0건으로 `상`을 준 Kafka 초안에 GPT-5.4는 `중`과 Critical 2건을 냈다. lag을 "consumer가 실제로 처리한 offset" 기준으로 정의해서 커밋된 offset과 애플리케이션의 처리 완료를 섞었고, `min.insync.replicas`의 근거 링크가 Kafka 0.8.2 문서였다. 멱등성 문서도 같은 키가 동시에 두 번 들어오는 경우가 빠졌다는 Critical 1건으로 `중`을 받았다. 지적된 세 가지는 모두 커밋 전에 고쳤다. 경계선이면 낮추라는 규칙은 reviewer가 문제를 봤을 때만 작동한다. 오류 자체를 못 보면 경계선도 없다.

`consistency-checker`에는 다른 종류의 울타리를 쳐 뒀다. 에이전트 정의에 이렇게 적혀 있다.

> 역할 경계: 링크/구조 문제는 직접 수정한다. 콘텐츠 누락은 보고만 한다 (content-writer 영역). 기술적 오류는 보고만 한다 (content-reviewer 영역). consistency-checker가 콘텐츠를 직접 생성하면 content-writer의 스타일 분석, AGENTS.md 준수, 면접 적합성 확보 절차를 우회하게 되어 품질이 보장되지 않는 콘텐츠가 리뷰 없이 추가된다.

README에는 있는데 파일이 없는 문서는 구조 문제처럼 보인다. 능력이 충분한 consistency-checker라면 직접 채우려 들 수 있다. 사실은 콘텐츠 문제다. 엉뚱한 에이전트가 고치면 writer의 스타일 분석과 reviewer의 등급 판정을 건너뛰고, 아무도 평가하지 않은 문서가 늘어난다.

## Output Contract: 에이전트 사이의 ABI

오케스트레이터는 reviewer의 등급에 따라 분기한다.

```
IF overall == "하":                              writer 재작성 후 재리뷰 (최대 2회)
ELIF overall == "중" AND critical_count > 0:     writer 1회 수정 (재리뷰 없음)
ELIF overall == "중":                            publish; Enhancement 항목만 보고
ELIF overall == "상":                            publish
```

1회 수정에서는 일부러 재리뷰를 건너뛴다. Critical 항목마다 reviewer가 수정 제안을 구체적으로 적어 두니 다시 판단할 것 없이 적용만 하면 되고, writer가 끝나면 SubagentStop hook이 링크 체커를 다시 돌린다.

이 분기는 오케스트레이터가 자유 형식 리뷰에서 `overall`과 `critical_count`를 안정적으로 뽑아낼 수 있어야 작동한다. 에이전트한테 등급을 명확히 표시하라고 부탁하는 걸로는 부족하다. 어떤 때는 리스트 안에, 어떤 때는 섹션 헤더로, 어떤 때는 그냥 한 문장으로 쓴다.

그래서 에이전트 셋 모두에 Output Contract가 있다. reviewer의 contract는 사람이 읽는 마크다운 안에 기계가 파싱할 블록을 넣게 한다.

```md
<!-- REVIEW_SUMMARY
overall: 상|중|하
accuracy: 상|중|하
interview_fit: 상|중|하
style: 상|중|하
critical_count: N
-->
```

reviewer는 본문과 함께 이 블록을 채우고, 오케스트레이터는 이걸 파싱한다. HTML 주석이라 렌더되지 않으니 `_workspace/{topic}/02_review.md`를 사람이 훑을 땐 안 보인다. writer의 `Writer Output` 블록(`작업 유형`, `대상 파일`, `줄 수`, `주요 섹션` 등)과 `consistency-checker`의 `<!-- CONSISTENCY_SUMMARY -->`도 같은 방식이다.

계약을 적어 둬도 가끔은 안 지킨다. contract를 넣은 당일에 나온 리뷰 하나는 요약 블록 없이 목록만 있었고, GPT-5.4로 돌린 consistency-checker는 `CONSISTENCY_SUMMARY`를 `key: value` 대신 문장 목록으로 채웠다. 그래서 오케스트레이터에는 폴백이 있다. 블록을 못 읽으면 본문에서 등급을 찾고, 그래도 없으면 `중`으로 두고 사람에게 확인을 넘긴다.

## 링크 검사는 hook이 한다

에이전트마다 Self-Verification 체크리스트가 있다. writer의 체크리스트는 10개 항목이다. front matter가 있는지, 목차의 앵커 링크가 실제 헤딩과 맞는지, 트레이드오프를 다뤘는지, README에 새 문서 링크를 넣었는지 등을 제출 전에 하나씩 확인한다.

처음 이틀 남짓은 이 목록에 "링크 체커 스크립트를 실행했는가"도 한 줄로 들어 있었다. 실행했다는 보고는 받을 수 있지만 정말 돌렸는지는 보고만 봐서는 모른다. 에이전트는 보고서 모양만 맞추고 검증 단계를 건너뛸 수 있고, 그래도 자기가 확인했다고 믿는다. 4월 7일에 그 줄을 지우고 hook으로 옮겼다.

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

두 에이전트 중 하나가 끝나면 Claude Code가 링크 체커를 실행한다. exit code 2면 에이전트는 멈추지 못하고, stderr로 돌아온 체커 출력을 보고 링크부터 고쳐야 한다. 링크를 확인했다는 주장 대신 스크립트 결과가 남는다. reviewer는 matcher에 없다. 문서를 고치지 않으니 검사할 것도 없다.

하네스에서 가장 싼 안전장치다. 체커는 180줄짜리 파이썬 스크립트이고 문서 69개를 도는 데 0.1초도 안 걸린다. 그 대가로 404 링크나 깨진 앵커가 박힌 채 publish되는 일이 없다.

`_workspace/{topic}/`은 지우지 않고 남긴다. `.gitignore`에 들어 있어 커밋되지는 않지만, 초안과 리뷰, 구조 검증 보고서가 주제별로 쌓여 있어서 위의 등급 집계와 Kafka 리뷰도 거기서 다시 찾을 수 있었다.

하네스는 작다. 에이전트 셋, 스킬 넷, hook 하나. 출력 형식과 링크처럼 기계로 확인할 수 있는 건 구조로 막았고, 리뷰의 질은 아직 reviewer 모델 하나의 눈에 걸려 있다.

---

*코드: [.claude/](https://github.com/zeikar/backend-interview-guide/tree/main/.claude). 프로젝트: [backend-interview-guide](https://github.com/zeikar/backend-interview-guide).*

*처음 이 글은 "경계선이면 낮게" 규칙이 등급 부풀림을 막는다고만 썼다. 2026년 11월에 `_workspace/`의 리뷰 기록을 다시 보니 대부분 `상`이었고, 기본 reviewer가 놓친 오류를 다른 모델의 리뷰가 잡은 사례가 있어서 그 내용을 더했다. 문서 수, 체크리스트 항목 수, 링크 체커 실행 시간도 실제 값으로 고쳤다.*
