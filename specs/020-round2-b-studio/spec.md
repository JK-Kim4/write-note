# Feature Spec: Round 2 — B 집필실 페이지 분할·용지 크기·반응형 패널

**Branch**: `020-round2-b-studio` | **Date**: 2026-06-12 | **Milestone**: Round 2 (GitHub #39·#40·#41·#50)

**전략 SoT**: `docs/plan/04-web-launch-v1-plan.md` §Round 2 (2026-06-12 B 기준 재구성)
**리서치 근거**: deep-research 보고(2026-06-12, run `wf_27432ce0-662`) — TipTap heading API / CSS `column-height` 브라우저 지원 / Next.js 레이아웃 영속 검증

## 배경 — 왜 B 기준 재구성인가

원래 Round 2(2026-06-11)는 A 디자인(Rail 셸 + PaperEditor) 기준 4항목이었다. B타입 디자인 기본값화(`52edefe`) 이후 실측:

| 원항목 | A 기준 | B 실측 | 처리 |
|---|---|---|---|
| F3 H1 버튼 | BubbleMenu에 H1 추가 | BEditor 툴바에 H1·H2·H3 **이미 있음** | R2-3 검증 |
| F2 용지 크기 | desktop-app.css 변수화 | B는 분할 없는 흐름형 — **용지 개념 부재** | R2-1 재정의(분할 이식 후 도입) |
| B1 좁은 폭 패널 | A `.side-panel display:none` | B 좌/우 패널 **반응형 전무** | R2-2 재정의 |
| B2 Rail 동선 | 페이지별 Rail import 누락 | `app/b/layout.tsx` 헤더 네비 **레이아웃 영속** | R2-3 검증 |

**사용자 결정(2026-06-12)**: ① Round 2 = B 디자인 기준 재구성 ② A 디자인 동결(신규 기능 미적용, 선택 옵션으로 잔존) ③ 용지 크기 = B 에디터에 페이지 분할을 먼저 이식한 뒤 도입.

## User Stories

### US1 (P1) — B 집필실 페이지 분할 + 용지 크기 (#40 재정의)

작가로서, B 집필실에서 본문이 종이 장 단위로 분할되어 보이고 용지 크기(A4·A3·A2·B4)를 고를 수 있기를 원한다. 출판/원고 분량 감각을 종이 단위로 잡기 위함이다.

**수용 기준:**
- AC1-1: 본문 작성 시 한 장(용지별 정수 줄수)을 채우면 다음 장으로 실시간 분할된다(브라우저 레이아웃, 입력 중 transform 0).
- AC1-2: 각 장은 흰 종이 시트(둥근 모서리·그림자·줄선 옵션)로 그려지고 하단에 쪽번호가 붙는다 — B 스킨(인디고 액센트·gray-200 보더) 유지, A의 나무 책상/웜페이퍼 톤은 **미도입**.
- AC1-3: 설정(`/b/settings`)에서 용지 4종을 고르면 즉시 반영되고 서버에 영속되어 다기기 동기화된다(019 PreferencesSync 패턴).
- AC1-4: **한국어 IME 4케이스**(빠른 타자·조합 중 mark·한자 변환·Backspace 분해)가 분할 이식 후에도 무유실(`docs/poc/0-1-tiptap-korean.md` SoT).
- AC1-5: `column-height` **미지원 브라우저**(Safari·Firefox 등 비-Chromium)에서는 현행 B 흐름형 본문으로 자연 폴백 — 깨짐 0, 용지 선택은 본문 폭에만 반영(또는 무시)되고 분할은 비활성.
- AC1-6: 기존 자동저장·draft 복원·충돌(useDocumentSession)·작업세션(useWorkSession)·아웃라인(useEditorOutline) 동작 **불변**.

### US2 (P2) — B 집필실 좁은 폭 패널 대응 (#41 재정의)

작가로서, 좁은 화면에서도 좌 목차·우 곁쪽지/인물 패널에 접근할 수 있기를 원한다.

**수용 기준:**
- AC2-1: breakpoint(기준 880px) 미만에서 좌 목차 패널·우 BWorkSidePanel이 본문을 압착하지 않는다.
- AC2-2: 좁은 폭에서 각 패널은 토글로 열고 닫는 drawer/오버레이로 접근 가능하다 — **숨김 일변도 금지**(접근 수단 보장).
- AC2-3: 넓은 폭에서는 현행 3패널 고정 레이아웃 불변.

### US3 (P3) — 검증·소규모 격차 (#39·#50 잔여)

**수용 기준:**
- AC3-1: B 툴바 H1·H2·H3 토글 + `isActive` 표시 정상 동작 확인(신규 개발 0).
- AC3-2: 좌측 목차(`useEditorOutline`)가 H3도 포함한다(현재 H1·H2만 파생 → default H3 포함).
- AC3-3: `app/b/layout.tsx` 헤더 네비가 모든 `/b/*`(works·settings·characters·memos·logs) 라우트에서 영속(리렌더·언마운트 0) 확인.
- AC3-4: A 디자인 동결을 `docs/plan/04`·vault에 기록.

## 비범위 (Out of Scope)

- A 디자인(`/`·`/projects`·PaperEditor)에 Round 2 신규 기능 적용 — 동결.
- 용지별 정밀 metric(실제 mm 1:1) — 기존 stylized(줄수 정수배) 모델 유지, 용지 height 비율로 줄수만 스케일.
- export 시 용지 설정(Round 3 PDF가 별도 처리).
- 분할 미지원 브라우저에 JS 기반 분할 폴리필 — 흐름형 폴백으로 갈음.

## 의존·정합

- **신규 에러 코드·HTTP status 분기 0**(client.ts status 분기 룰 무관).
- **스키마 변경 0** — 설정은 기존 `user_settings`(019 V10) key-value에 `paperSize` 1키 추가(allowlist 1줄).
- TS RSC 경계: 신규/변경 컴포넌트 전부 `'use client'`(이미 client 트리).
- 한국어 검증 cadence(HARD-GATE): TipTap 렌더 구조 변경 → IME 4케이스 dogfooding 의무.
