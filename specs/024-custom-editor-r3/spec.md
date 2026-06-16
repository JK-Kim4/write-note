# 자체 에디터 R3 — 블록 패리티 + 소프트 줄바꿈

- 상위 설계: `docs/superpowers/specs/2026-06-16-custom-editor-full-replacement-design.md`
- 선행: R1(구조·문단·제목·페이지분할), R2(마크·혼합폰트·affinity)
- 브랜치: `023-export` (전면 교체 R3~R7 공통, 브랜치 churn 없음)
- 백엔드 변경: 0

## 개요 (Overview)

자체 EditContext 엔진을 TipTap 기본 에디터의 **손실 0 대체재**로 만들기 위한 마지막 콘텐츠 패리티 라운드. 현재 자체 엔진은 문단·제목·4종 마크만 무손실이고, **인용(blockquote)·글머리표/번호목록(bullet/ordered list)·구분선(horizontalRule)** 블록과 **소프트 줄바꿈(Shift+Enter / hardBreak)** 을 평문 평탄화하거나 드롭한다. 본 라운드에서 이 5가지를 자체 엔진에 1급으로 추가하고, ProseMirror JSON 왕복을 무손실·idempotent로 보장한다.

본 라운드의 dogfoodable 핵심: **프레시 테스트 챕터에 5종 블록 + 4종 마크 + Shift+Enter 줄바꿈을 작성 → 저장 → 재로드했을 때 손실 0.** (R4의 기존 데이터 교체는 이 라운드가 통과해야 안전.)

## 사용자 스토리 (User Stories)

### US1 — 블록 서식 입력·표시 (P1, 양보불가 핵심)

작가로서, 자체 엔진에서 **인용·글머리표·번호목록·구분선**을 TipTap에서와 똑같이 입력하고 보고 싶다.

**독립 테스트 기준:** 프레시 챕터에서 툴바(또는 단축)로 각 블록을 만들면 화면에 인용선/마커/번호/가로선이 올바로 렌더되고, 캐럿 이동·타이핑·페이지 분할이 깨지지 않는다.

수용 기준:
- 인용: 좌측 인용선 + 들여쓰기. 캐럿·타이핑은 문단과 동일.
- 글머리표 목록: 항목마다 마커(•). 항목 1개 = 블록 1개.
- 번호 목록: 연속 항목에 1·2·3… 자동 번호(저장 안 함, 렌더 시 파생). 중간에 비목록 블록/다른 종류가 끼면 번호 재시작.
- 구분선: 가로선. 텍스트 없는 원자 블록 — 캐럿이 안으로 못 들어가고 위/아래로 건너뛰며, Backspace로 블록 삭제.
- 4종 마크(굵게/기울임/밑줄/취소선)는 인용·목록 블록 안에서도 그대로 적용.

### US2 — 소프트 줄바꿈 (P1)

작가로서, 목록 항목이나 문단 안에서 **Shift+Enter로 번호 증가 없이 줄만 추가**하고 싶다(보통 에디터 관습).

**독립 테스트 기준:** 번호 목록 항목 안에서 Shift+Enter를 치면 같은 항목(같은 번호)에 줄이 추가되고, Enter를 치면 새 항목(다음 번호)이 생긴다.

수용 기준:
- Shift+Enter → 같은 블록 안 줄바꿈(블록·목록 번호 불변). Enter → 새 블록(목록이면 새 번호).
- 소프트 줄바꿈 지점에서 시각 줄이 강제로 나뉘고, 그 줄도 페이지 분할 대상.
- 캐럿이 소프트 줄바꿈 앞/뒤로 정상 이동, Backspace로 줄바꿈 삭제(줄 병합).

### US3 — 왕복 무손실·idempotent 저장/재로드 (P1, R4 안전의 전제)

작가로서, 위 블록·줄바꿈을 쓴 챕터를 저장하고 다시 열어도 **글자·서식·구조가 하나도 안 바뀌길** 바란다.

**독립 테스트 기준:** 5종 블록 + 4종 마크 + 소프트 줄바꿈을 담은 문서를 `model → PM JSON → model`로 왕복했을 때 첫 왕복과 둘째 왕복 결과가 동일(idempotent)하고, 원본 의미가 보존된다.

수용 기준:
- `pmJsonToModel(modelToPmJson(m))` 가 의미 보존(블록 타입·마크·목록 종류/depth·소프트 줄바꿈).
- 왕복 idempotence: `modelToPmJson(pmJsonToModel(x))` 를 두 번 적용한 결과가 한 번 적용과 바이트 동일 → 로드 즉시 거짓 dirty 없음(자동저장 HARD-GATE).
- 기존 본문의 `hardBreak`(`<br>`)가 소프트 줄바꿈으로 보존(현 잠재 손실 해소).
- 마크 없는·블록 없는 기존 본문은 R1/R2 출력과 바이트 동일(무회귀).

## 기능 요구사항 (Functional Requirements)

- **FR-001** `BlockAttr` 유니온에 `blockquote` / `listItem{listKind:"bullet"|"ordered", depth:number}` / `hr` 추가.
- **FR-002** `buffer`에 블록 내 소프트 줄바꿈 마커 `U+2028`(LINE SEPARATOR) 도입. `blockRanges`는 `\n`으로만 블록 분리(`U+2028`은 블록 경계 아님).
- **FR-003** measure: 인용 들여쓰기·목록 마커 폭만큼 content 폭 축소, `U+2028`에서 강제 줄나눔. canvas 금지(오프스크린 styled-DOM + Range 유지).
- **FR-004** 번호 목록 번호는 저장하지 않고 렌더 시 파생(연속 동일 listKind·depth 카운트, 경계에서 재시작).
- **FR-005** 구분선은 빈 텍스트 원자 블록 — 캐럿 진입 불가, 화살표 건너뜀, Backspace 블록 삭제.
- **FR-006** 입력 라우팅: Shift+Enter → `U+2028` 삽입(같은 블록), Enter → splitBlock(새 블록). IME 조합 중 가드는 `compositionstart/end` 유지.
- **FR-007** 툴바: 인용·글머리표·번호목록·구분선 토글 버튼 추가(B형 BEditor 툴바 구성 참조). 활성 상태 표시.
- **FR-008** `pmConvert`: blockquote/bulletList/orderedList/listItem/horizontalRule/hardBreak 노드 ↔ 모델 무손실 왕복. 연속 동일 종류 listItem 블록을 하나의 list 노드로 재그룹.
- **FR-009** 불변식 유지: INV-1(blockAttrs.length = 세그먼트 수), INV-4(run len 합 = 블록 글자 수, `U+2028` 포함), INV-5(run 정규형).
- **FR-010** pagination(layoutEngine·geometry)은 블록 단위 줄 분할을 그대로 사용 — 무수정 동작 확인(신규 블록도 줄 리스트로 측정되어 분할됨).

## 성공 기준 (Success Criteria)

- **SC-001** 프레시 챕터에 5종 블록 + 4종 마크 + Shift+Enter 작성 → 저장 → 재로드 시 화면·구조 손실 0 (dogfooding).
- **SC-002** 왕복 결정론 테스트: 대표 문서 집합에 대해 `modelToPmJson(pmJsonToModel(x))` idempotent (vitest GREEN).
- **SC-003** 자동 게이트 GREEN: `tsc --noEmit`, vitest(`src/components/custom-editor`), `pnpm build`.
- **SC-004** 무회귀: 마크/블록 없는 기존 본문 왕복이 R1/R2와 바이트 동일.

## 엣지 케이스 (Edge Cases)

- 빈 목록 항목에서 Enter(빈 항목 종료 → 문단 강등) / 구분선 직후 캐럿 / 문서 첫·끝 구분선.
- 소프트 줄바꿈만 있고 글자 없는 줄, 소프트 줄바꿈 연속.
- 목록 항목 안 마크 토글 + Shift+Enter 조합(보류 마크 유지).
- 한글 IME 조합 중 Shift+Enter / 블록 토글(PoC 0-1 4케이스 재사용).
- 깊게 중첩되거나 한 항목에 독립 문단 여러 개인 기존 본문 → 얕은 항목들로 분해(글자 손실 0, 설계 §3 합의).

## 범위 밖 (Out of Scope)

- 표(table), 이미지, 링크, 코드블록(향후 라운드 — 현 평문 평탄화 유지).
- 깊은 중첩 리스트(한 항목 다문단/하위리스트)의 1:1 구조 보존.
- A·B 셸 교체(R4·R5), TipTap 폐기(R6), export(R7).
- 원고지 모드(별도 트랙).
