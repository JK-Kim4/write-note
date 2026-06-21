# Research: 출판 방식 선택 기반 에디터 레이아웃

**Feature**: 031-publish-layout-modes | **Date**: 2026-06-21

코드 grep + 웹 조사로 확정한 결정 모음. 모든 NEEDS CLARIFICATION 해소.

---

## D1. 웹 출판 연속 표시 경로 (가장 불확실 — R2 PoC 대상)

**Decision**: `layoutEngine.layout()`에 "미분할" 분기를 추가해 측정된 모든 블록을 **단일 페이지(`pages.length === 1`)**로 배치한다. `CustomEditor`는 `layoutMode==='web'`일 때 (a) 단일 페이지를 세로 스크롤로 렌더하고 (b) 페이지 넘김 네비/`currentPage` 동기를 비활성화한다. 좌표계(`caretToScreen`/`screenToCaret`)는 `pageIndex` 가 항상 0이고 `offsetY`가 전체 문서 절대 y가 되도록 어댑터를 둔다.

**Rationale**:
- 현재 파이프라인 `relayout(model, geo) → View{blocks, pages}`에서 분할은 `layout(measured, contentHeightPx)` 한 곳에만 있다(`layoutEngine.ts:34`). `contentHeightPx`를 사실상 무한(또는 모드 플래그)으로 주면 한 페이지에 전 줄이 담겨, **measure/printLayout/geometry 의 줄 측정 로직은 그대로 재사용**된다(측정은 `contentWidthPx` 기반, 높이와 무관 — `measure.ts:164`).
- 029 머지로 `CustomEditor`는 이미 `view.pages[safePage]` 한 장만 렌더한다(`CustomEditor.tsx:1228,1235`). 웹 모드는 "한 장만 렌더"를 "그 한 장을 스크롤"로 바꾸면 되어 변경면이 좁다.
- 좌표계가 `pageIndex` 절대 기준(`CustomEditor.tsx:66,111`)이라, 페이지가 1개뿐이면 `pageIndex=0` 고정 + `offsetY`가 곧 문서 절대 y가 되어 자연 정합한다.

**가장 큰 위험 3곳** (R2 PoC 가 반드시 검증):
1. `layoutEngine.layout()` 분기 — 무한 높이 시 fragment 분할 로직(`:46-81`)이 빈 페이지/무한루프 없이 단일 페이지를 반환하는가.
2. `caretToScreen`/`screenToCaret` — 단일 페이지에서 캐럿/선택/드래그가 정상 동작하는가(한국어 IME 조합 포함).
3. `geometry` 높이 — 측정용(오프스크린 div)과 레이아웃용(무한) 높이를 분리해 측정 오류가 없는가.

**Alternatives considered**:
- *별도 연속 렌더 컴포넌트 신설*: 코드 중복 크고 좌표계/IME/자동저장을 두 벌 유지 → 회귀 위험. 기각.
- *CSS overflow 로 페이지 박스만 늘리기*: 분할 로직은 그대로라 페이지 경계가 남아 "연속"이 안 됨. 기각.

**PoC 게이트**: 작은 범위로 `layout(∞)` + 웹 렌더 분기만 띄워 한국어 IME 4케이스 + 캐럿/선택/스크롤/자동저장을 dogfood. 통과 전 결선·다중 커밋 금지(§10 process weight).

---

## D2. 종이 판형 프리셋 & 실측 분량 (R3)

**Decision**: `geometry.ts`의 `PAPER_MM`에 판형 4종을 추가하고, `pageGeometry`에 **판형별 조판 프리셋**(폰트·여백)을 주입한다. 폰트(출판 표준 ~10pt)·행간(1.8)은 4판형 공통, **여백·크기만 판형별**. 신국판을 분량 앵커로 잡아 "1페이지 ≈ 200자 원고지 3.5매(700~800자)"가 나오도록 폰트/여백을 보정하고, 나머지 판형은 같은 폰트·여백 규칙 + 판형 크기로 면적비 근사가 자연 발생하게 한다.

**판형 치수(재단 크기, mm)**:
| 판형 | 가로 | 세로 |
|---|---|---|
| 신국판 | 152 | 225 |
| 국판 | 148 | 210 |
| 46판 | 128 | 188 |
| 문고판 | 105 | 148 |

**조판 기준(공통, 웹 조사 수렴값)**: 본문 폰트 ~10pt, 행간 약 1.8배(180%), 안쪽 여백을 바깥보다 +3~5mm. v1은 상하/좌우 단순 여백으로 시작(현재 `MARGIN_MM=25` 고정을 판형별 값으로 파라미터화).

**Rationale**: 한국 출판계에 공식 조판 표준은 없고(범위·관행값), 교차검증된 단 하나의 단단한 앵커가 "신국판 1면 ≈ 원고지 3.5매"다(서울경제·편집자 brunch·분량환산 다수 일치). 신국판 외 판형의 자수×행수 직접 프리셋은 출처가 빈약 → 면적비 근사가 추측을 피하는 방어 가능한 선택(`CLAUDE.md` 추측 금지 정합).

**구현 메모**: `pageGeometry(size, fontSizePx, lineHeightRatio=1.8)` 시그니처에 `marginMm`(또는 판형 프리셋 객체) 추가. `FONT_SIZE_PX=18`(약 13.5pt) 고정을 판형 프리셋의 출판 표준 폰트로 교체하되, 화면 가독성은 기존 `userZoom`(`CustomEditor.tsx:440`)으로 흡수(작은 폰트 → 확대 표시). zoom 메커니즘은 이미 존재해 추가 작업 적음.

**Alternatives considered**:
- *판형별 자수×행수 직접 프리셋*: 신국판 외 근거 약함 → 추측. 기각(비범위).
- *작가 수동 조판 조절*: v1 비범위(brainstorming 확정).

**근거 보강 여지**: 정밀 프리셋이 필요하면 POD 업체(bookpub 등) 판형별 HWP 템플릿 실측이 다음 단계(현재는 면적비로 충분).

---

## D3. 글자수 카운트 (R4, 웹 모드)

**Decision**: 신규 순수 헬퍼 `charCount.ts`를 만들어 `DocModel`(또는 `model.buffer`)에서 **공백 포함/제외 글자수**를 계산한다. 표기는 공백 제외를 우선, 공백 포함을 보조로(웹소설 플랫폼 관행).

**Rationale**: frontend 에 DocModel 기반 글자수 함수가 없다(`wordCountUtils.extractPlainText`는 ProseMirror JSON 기반, 자체 에디터 모델 아님). `model.buffer`는 블록을 `\n`으로 잇는 평문 SoT라 길이·공백 제거가 단순·결정론적이다. 순수 함수라 TDD HARD-GATE 대상(테스트 우선).

**Alternatives considered**: 백엔드 집계(불필요한 왕복, 실시간성 저하) 기각. 기존 `wordCountUtils` 재사용(모델 불일치) 기각.

---

## D4. 데이터 모델 — layoutMode (R1)

**Decision**: `projects.layout_mode VARCHAR(16) NOT NULL DEFAULT 'paper'` + `CHECK (layout_mode IN ('paper','web'))` (V17). 엔티티/요청/응답 DTO + 매퍼 + `ProjectService.validatedLayoutMode` + `ALLOWED_LAYOUT_MODES=setOf("paper","web")`.

**강제 선택 전략**: 프론트 생성 폼에서 미선택 시 생성 차단(FR-001). 백엔드는 기존 호환을 위해 `layoutMode: String? = null`을 받아 null→'paper' 기본 처리(기존 클라이언트·기존 데이터 안전). "강제"는 UX 계층에서 보장.

**Rationale**: V12 paper_size 패턴(컬럼 추가 + CHECK + 기존행 기본값)과 동형이라 검증된 마이그레이션 방식. 기본 'paper'가 FR-013(기존 작품 페이지 분할 보존) 충족.

**Alternatives considered**: 백엔드 required(@NotNull) — 기존 클라이언트/구버전 FE 가 400 → 배포 순서 위험. 기각(FE 강제 + BE 관대).

---

## D5. paperSize enum 확장 (R3)

**Decision**: `paper_size` CHECK 제약을 8종(`A4,A3,A2,B4,신국판,국판,46판,문고판`)으로 교체(V18). 백엔드 `ALLOWED_PAPER_SIZES`·`SettingsService.ALLOWED["paperSize"]` 동기. 프론트 `geometry.ts` PaperSize 타입 + `library`/`BStudioShell`/`settings` select 옵션 확장.

**저장 식별자**: DB·DTO 는 문자열. 식별자는 ASCII 권장(`sinkukpan`/`kukpan`/`pan46`/`mungopan`)으로 두고 표시 라벨만 한글("신국판" 등) — DB CHECK·URL·로그 안전. (대안: 한글 식별자 직접 저장 — VARCHAR 가능하나 인코딩·grep 리스크. ASCII 식별자 채택.)

**Rationale**: 기존 ISO 4종 병행 유지(FR-005, 기존 데이터 보존). geometry.ts(`A5|A4|B4|A3|A2`)와 pageLayout.ts(`A4|A3|A2|B4`) 두 타입이 별개로 존재 → 집필실 경로는 geometry.ts 기준이므로 판형 4종은 **geometry.ts 우선** 확장하고 저장 문자열 정합을 맞춘다.

**주의(검증 지점 누락 방지)**: paperSize 허용값은 백 2곳(`ProjectService`/`SettingsService`) + DB CHECK + 프론트 6곳에 흩어져 있어, 8종 확장 시 전부 동기(누락 시 거짓 ValidationException/400). data-model.md 의 체크리스트로 강제.

---

## D6. 모드 전환 무손실 (R1/US4)

**Decision**: 전환은 `updateProject` PATCH `{layoutMode}` 한 번. 본문(`DocModel`/챕터 bodyJson)은 전환에서 미변경 — 렌더 분기만 바뀐다. 챕터 전환 세션(022 `key={documentId}` 리마운트)·자동저장(016)은 그대로.

**Rationale**: 텍스트 모델과 표시의 분리(spec Assumptions)가 무손실의 구조적 근거. 전환 시 저장 데이터에 손대지 않으므로 손실 경로 자체가 없다.

**검증**: quickstart.md 의 전환 시나리오(본문 있는 작품 web↔paper 왕복 후 텍스트 동일)로 dogfooding.
