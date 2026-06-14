# 022 챕터(작품 1:N) — 거짓 409 회귀와 무한루프 OOM 회고

- 일자: 2026-06-14
- 워크트리 / 브랜치: write-note / `022-chapters` → `develop` merge `1add4b6`
- 관련 커밋: `ea1f0d8`(Foundational) ~ `516dbcc`(본문 제목 인라인) 19 커밋 / merge `1add4b6`
- 해결 이슈: #58~#62 (Round 2.5 챕터 마일스톤 5/5 완료)
- 작업: speckit 풀파이프 + subagent-driven 구현 + dogfooding 후속(거짓 409 / OOM / 표현)

## 1. 무엇을 했는가 (사실)

- 챕터 기능을 컨텍스트 수집(sonnet subagent 3 fan-out — 요구문서/BE 정합/FE 정합)으로 시작, speckit 풀파이프(specify→plan→tasks→analyze) 산출.
- plan 단계에서 설계 문서의 `V9` 마이그레이션 표기를 실측(현 최신 V13) 후 **V14로 정정**(설계/계획/spec 8곳).
- subagent-driven으로 Foundational(#58, V14+엔티티 1:N) + US1~US4 + Polish 구현. 각 task에 implementer + **spec 준수 + code quality 2단계 리뷰**.
- 2단계/통합 리뷰가 Important 결함 차단: updateDocumentTitle soft-delete 가드 누락 / US4 마지막 문장이 "첫 챕터"에서 온 spec 불일치 / **US2 순서버튼 page 미결선**(통합 리뷰).
- dogfooding(사용자 브라우저)에서 발견·수정한 후속 3건:
  1. **거짓 409 저장충돌 재발** → 방안 A(에디터+세션을 `ChapterEditor`/`BChapterEditor`로 분리, `key={documentId}` 리마운트).
  2. **챕터 패널 CSS 전무** → `desktop-app.css` BEM 정돈.
  3. **본문 상단 챕터 제목 + 인라인 rename**(`InlineEditableTitle` 공용).
- 방안 A 도중 발견한 **BChapterEditor 무한루프 → JavaScript heap OOM** 격리·수정.
- finish-work: develop merge + vault(02-PROGRESS/03-ISSUES) + GitHub 이슈 close.

## 2. 어떻게 했는가 (접근)

- **subagent-driven**: Opus advisor(나)가 각 task 게이트 직접 재실행·diff 검증, Sonnet implementer가 구현. 자기진단("기존 회귀") 무검증 수용 금지(§7) — US4 spec reviewer의 "마지막 문장 첫 챕터" 발견을 직접 코드/DB로 재확인 후 보강.
- **systematic-debugging**: 거짓 409는 추측으로 고치지 않고 코드(useDocumentSession initRef 가드)+DB(1936·1937 동시 updated_at)로 레이어를 확정한 뒤 방안 A. OOM은 전체→단일 파일 실행으로 B형 page test를 범인으로 격리, 그 안에서 BChapterEditor의 session deps 무한루프 특정.
- **fable-test 참조**: 사용자가 "코드 보면 구현돼있다"고 했으나 실제론 `IMPLEMENTATION_PROMPT.md` 명세뿐(코드 0) — 정직히 surfacing하고 명세의 챕터 모델("챕터 선택 시 내용 로드, 챕터별 독립")과 write-note 구현 차이를 대조. 방안 A가 그 모델로 수렴함을 확인.

## 3. 잘 된 점

1) **2단계 + 통합 리뷰가 회귀를 연쇄 차단** — updateTitle 가드(code quality), US4 마지막 문장 spec 불일치(spec reviewer), **US2 순서버튼 page 미결선**(통합 리뷰). 근거: 각 리뷰가 구체 Important를 file:line으로 짚었고 모두 수정됨. 컴포넌트 단위 리뷰가 놓친 결선을 통합 리뷰가 잡은 게 결정적.
2) **거짓 409 근본 원인 1회 추적** — systematic-debugging으로 헛수정 0. 코드(initRef 1회 가드)+DB(동시 updated_at)로 "세션이 page 단일 인스턴스라 documentId 변경을 안 따라감"을 확정. 과거 016 회고(§11 헛수정 반복)의 교훈이 작동.
3) **OOM 격리** — 힙 4GB로도 OOM이라 누수로 판단 → 단일 파일 실행으로 B형 page test 격리 → BChapterEditor `handleReload/handleOverwrite` useCallback의 `session` deps 무한루프 특정 → 1줄(ref 안정화) 수정. 격리→근본→최소수정 흐름.
4) **plan 단계 V9→V14 실측 정정** — 마이그레이션 버전 격차를 구현 전에 차단(설계 작성 시점 V8 → 실제 V13).

## 4. 어긋난 점

- **거짓 409 회귀 자체 (핵심)** — 016 자동저장(1:1 전제: page 단일 세션 + initRef 1회)을 챕터 전환에 그대로 재사용하면서 세션 stale를 놓침. US1 구현 시 `editorKey`로 PaperEditor만 리마운트하고 **세션 재초기화를 놓침**. 자동화 테스트(T009 draft 키 격리)는 localStorage 키만 봤지 **version 토큰 stale → 409 경로**를 안 봐서 게이트 GREEN(259)인 채 dogfooding까지 통과. **회피 가능 시점**: US1 챕터 전환을 설계할 때 "세션이 documentId를 따라가는가(재초기화/리마운트)"를 점검했어야.
- **무한루프 OOM** — 방안 A의 BChapterEditor가 `handleReload/handleOverwrite`의 `useCallback` deps에 `session`(useDocumentSession 반환, 매 렌더 새 객체)을 넣어 → `onConflict` effect 무한 실행 → page `setConflictHandlers` 무한 → OOM. A형 ChapterEditor는 conflict를 내부 렌더라 무한 없음. 전체 게이트 test가 `ERR_IPC_CHANNEL_CLOSED`/OOM으로 표면화. **회피 가능 시점**: useDocumentSession 반환 함수를 애초에 `useCallback`으로 안정화했거나, B형도 A형처럼 conflict를 내부 렌더했으면 구조적 방지.
- **plan이 "마지막 문장 출처"를 잘못 가정** — contracts C9에 "ProjectCardResponse 불변 + FE 변경 0"으로 적었으나, 실제 마지막 문장은 응답에 없고 FE `projects.list`가 카드별로 단수 조회(첫 챕터)해 파생. US4 spec reviewer가 발견. **회피 가능 시점**: plan 단계에서 화면 표시값 출처를 실측(agent-workflow §9 — 표시값이 어떤 IPC·필드·파생에서 오는가).
- **ChapterList CSS 전무** — T014에서 컴포넌트만 만들고 BEM 클래스 CSS를 누락. 게이트(typecheck/lint/test/build)는 "클래스명 유효하나 스타일 빈"을 못 잡아 GREEN인데 화면은 ▲▼✕가 세로로 흩어짐. dogfooding 스크린샷에서 발견. **회피 가능 시점**: 컴포넌트 작성 task에 CSS 동반.
- **US2 순서버튼 page 미결선** — ChapterList 버튼 + useReorderChapters 훅 + endpoint는 됐으나 A·B page에 `onMove` 연결 누락 → 버튼이 화면에 안 보임. 내 US2 dispatch가 "ChapterList 버튼"까지만 명시하고 page 결선을 안 박음. 컴포넌트 단위 spec/code 리뷰가 못 잡고 통합 리뷰가 잡음. **회피 가능 시점**: dispatch에 "page 결선까지" 명시.
- **subagent의 "로컬 dev DB 적용 금지" 지시 위반** — 내가 모든 BE dispatch에 "로컬 dev DB 적용 금지(IT/Testcontainers만)"를 명시했는데, dogfooding 준비 시 V14가 **이미 로컬 dev DB에 적용**돼 있었음(구현 중 어떤 subagent가 bootRun/flywayMigrate 실행 추정). 결과는 무손실 정상이었으나 지시 위반. **회피 가능 시점**: dispatch 후 실제 DB 상태 확인, 또는 settings.json deny로 보강.
- **헛수정/재시도**: 거짓 409·OOM 모두 systematic-debugging으로 헛수정 0(과거 016 회고의 반성 반영). 단 dogfooding 후속이 fix 사이클로 누적(거짓409→OOM→링크회귀→미사용정리→표현→본문제목) — 한 dogfooding 발견이 여러 연쇄 수정을 부름. 사용자 멈춤 신호("매우 심각", "잘못구현된거같아")가 dogfooding 단계에서 발생, 그 이전 자동화 게이트는 못 잡음.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

1) **기존 1:1 인프라를 1:N으로 재사용할 때 "차원 변경 추종"을 먼저 검증** — 016 useDocumentSession처럼 단일 인스턴스 + 1회 초기화 전제인 인프라를, 키가 바뀌는 새 차원(documentId 전환)에 재사용하면 stale가 생긴다. 재사용 전 "이 인프라가 키 변경을 따라가는가(리마운트/재초기화)"를 점검.
2) **커스텀 훅 반환값(매 렌더 새 객체/함수)을 useCallback/effect deps에 직접 넣지 말 것** — 특히 effect가 부모 setState를 호출하면 무한루프→OOM. ref로 안정화하거나 훅이 반환 함수를 useCallback으로 안정화.
3) **presentational 컴포넌트 신설 시 CSS 동반** — 게이트는 스타일 공백을 못 잡는다. 컴포넌트 task에 CSS + dogfooding 전 시각 확인.
4) **컴포넌트+훅+endpoint가 다 돼도 page 결선을 별도 점검** — dispatch·리뷰에 "page에 prop/핸들러 연결까지" 명시. 통합 리뷰 의무.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — React deps 안정성 (무한루프/OOM 방지)**
- (1) 대상: `.claude/rules/typescript/code-quality.md` (React/Next.js 섹션)
- (2) 룰: "커스텀 훅 반환 객체/함수(매 렌더 새 인스턴스 가능)를 `useCallback`/`useEffect` deps에 직접 넣지 말 것. 반환 함수가 미안정이면 ref로 안정화한다. **effect가 부모 setState를 호출하는 경우 deps 불안정은 무한 렌더→OOM**으로 직결된다."
- (3) 근거: §4 BChapterEditor `handleReload/handleOverwrite` deps의 `session`(useDocumentSession 반환, 매 렌더 새) → onConflict effect 무한 → page setState 무한 → JavaScript heap OOM. 전체 게이트 test가 `ERR_IPC_CHANNEL_CLOSED`로 표면화.

**후보 2 — 기존 인프라 1:1→1:N 재사용 시 차원 추종 검증**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` (신규 §12)
- (2) 룰: "자동저장 세션·캐시·단일 인스턴스 상태 등 기존 인프라를 새 차원(1:1→1:N, 단일→다중)에 재사용할 때, 그 인프라가 **새 차원의 키 변경(예: documentId 전환)을 따라가는지**(리마운트/재초기화) 검증한다. '단일 인스턴스 + 1회 초기화' 가정을 점검하지 않으면 stale 상태가 새 차원에서 회귀한다."
- (3) 근거: §4 016 useDocumentSession(page 단일 + initRef 1회)을 챕터 전환에 재사용 → versionRef stale → 거짓 409 회귀. 자동화 테스트(draft 키 격리)가 version 토큰 stale 경로를 안 봐 dogfooding까지 미검출.

**후보 3 — presentational 컴포넌트 CSS 동반 (게이트 사각)**
- (1) 대상: `.claude/rules/typescript/code-quality.md` (React/Next.js 섹션)
- (2) 룰: "className(BEM 등)을 쓰는 presentational 컴포넌트를 신설할 때 **해당 CSS 정의를 같은 작업에서 동반**한다. 게이트(typecheck/lint/test/build)는 '클래스명 유효하나 스타일 빈'을 검출하지 못하므로, 시각 영역은 dogfooding 전 확인이 필요하다."
- (3) 근거: §4 ChapterList BEM 클래스 CSS 전무 → 게이트 GREEN인데 패널 어수선(스크린샷).

**후보 4 — subagent 인프라 안전 지시 위반 검증**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` (§7 확장 또는 신규)
- (2) 룰: "subagent에 인프라 쓰기 금지(로컬 DB migrate/적용 금지 등)를 지시했으면, 완료 후 **실제 상태를 직접 확인**한다(§7 자기보고 무검증 수용 금지의 인프라 확장). 가능하면 settings.json deny로 보강."
- (3) 근거: §4 모든 BE dispatch에 "로컬 dev DB 적용 금지" 명시에도 V14가 로컬 dev DB에 이미 적용됨(구현 중 추정). 결과는 정상이나 지시 위반.

**사용자 컨펌 전까지 실제 룰 파일 수정 금지.**
