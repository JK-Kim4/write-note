# Desktop 원고지 모드 — 라이브 칸 편집 집필 (작업 지시서 / design brief)

> **용도:** 본 문서는 `speckit-specify` 입력 brief(SDD, Spec-Driven Development)다. 2026-06-06 브레인스토밍(비주얼 동반 목업)으로 확정한 **원고지 모드**를 담는다. 이 문서를 근거로 `specs/NNN-.../`의 spec → plan → tasks → implement 를 생성한다.
>
> **메타**
> - 트랙: Desktop MVP (Electron 로컬 우선 앱). Phase 8 MVP review gate 종료 직후의 **다음 1순위 기능**(D3 확정).
> - 작성일: 2026-06-06
> - 기준 브랜치: `develop` (HEAD `9579f78` — Phase 8 review 판정 + Track A fix)
> - 상위 SoT: `PRODUCT.md`(전략) · `docs/DESIGN.md`(비주얼 토큰) · `docs/phase/08-mvp-review/2026-06-06-review.md`(D3 결정) · vault `02-PROGRESS.md`
> - 근거 산출물: 브레인스토밍 목업 `.superpowers/brainstorm/14474-1780750865/content/{scope,grid-fidelity,orientation,sheet-size}.html`
> - feature 번호: 010 예상(009 다음). 브랜치는 `speckit-git-feature` 부여.

---

## 1. 목표

작가가 **한 글자 한 칸의 정통 원고지에 직접 타이핑**하며 글을 쓰고, **지금까지 몇 매를 썼는지**를 상시 확인할 수 있게 한다. 집필 화면 본문을 "연속(현재)"과 "원고지" 두 보기 방식으로 선택하게 하여, 원고지 질감을 원하는 작가에게 집필 *깊이*를 제공한다.

이는 Phase 8 review에서 다음 1순위로 확정(D3 = 원고지 모드)된 기능이다. 실사용 마찰의 직접 신호보다 **제품 비전(집필 깊이)** 우선순위에 근거한다(review §4 D3).

---

## 2. 배경 — 왜 원고지 모드인가, 그리고 무엇이 위험한가

### 2-1. 결정 경위

- `DESIGN.md`가 A4 페이지뷰 + 원고지 격자를 구상했으나, TipTap 자동 페이지네이션이 불안정(`tiptap-pagination-plus` PoC 후 제거)하여 현재는 연속 A4("iA Writer식 순도")만 존재한다.
- Phase 8 review에서 "원고지 모드 vs richer memo curation" 중 **원고지 모드**를 D3로 확정. 메모는 009 재디자인으로 이미 작업실화됨.

### 2-2. 핵심 위험 (반드시 PoC로 먼저 깬다)

본 기능의 핵심인 **"라이브 칸 편집 + 한국어 IME"** 는 이 코드베이스에서 **검증된 적 없는 고위험 영역**이다. 같은 종류의 함정이 반복 발생했다:

- PoC 0-1 (`docs/poc/0-1-tiptap-korean.md`): TipTap 한국어 IME 4케이스.
- Phase 4 회귀: `onUpdate` 부모 re-render → 조합 중 자모 분리(`editor.view.composing` guard로 해소).
- 페이지네이션: `tiptap-pagination-plus` 불안정 → 제거.

따라서 본 기능은 **PoC 게이트로 시작**한다(사용자 확정, 브레인스토밍 빌드 구조). 라이브 칸 IME가 GREEN이 아니면 격자 방식을 재논의한다.

---

## 3. 현재 코드 상태 (실측)

| 영역 | 파일 | 현재 |
|---|---|---|
| 본문 에디터 | `desktop/src/components/Editor.tsx` | TipTap `StarterKit` + 연속 A4 종이(`.paper`), 고운바탕 18px 고정, BubbleMenu 서식, 줄노트(`lined`) 토글. `onUpdate`에 `editor.view.composing` IME guard. 본문 = ProseMirror JSON(`bodyJson`) + `plainText` + `wordCount`(공백·줄바꿈 제외) |
| 집필 화면 | `desktop/src/screens/WriteStudioScreen.tsx` | 종이 우선 + 보기 메뉴/곁쪽지 서랍(상호 배타) |
| 보기 메뉴 | `desktop/src/components/ViewMenu.tsx` | 접힌 팝오버 — 크기(`ZoomControl`)·줄노트·테마·자동저장. 각 행 `seg` 토글 |
| 상단 표시 | `Titlebar` (WriteStudioScreen 상단) | 제목 · 저장 상태 · 글자수 상시 |
| 설정 영속 | `app_settings` (node:sqlite) | 테마/자동저장 등 view 설정 영속(기존 패턴) |

**환경 주의:** `node:sqlite`는 Node 24 필요(`PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"`). 검증은 `node_modules/.bin/{vitest,tsc,vite}` 직접 실행(corepack pnpm lockfile 충돌 회피). 빌드/테스트 포어그라운드.

---

## 4. 확정된 설계 결정 (브레인스토밍 2026-06-06)

### 4-1. 모드 선택 (보기 방식)

- 집필 본문을 **`연속`(현재 기본) ↔ `원고지`** 로 선택. `ViewMenu`에 "본문 보기" 행 추가(기존 `seg` 토글 패턴).
- 선택은 `app_settings`로 영속(테마/자동저장과 동일). 작품별이 아니라 앱 전역 설정으로 시작(YAGNI — 작품별 필요성 미확인).

### 4-2. 원고지 격자 = 라이브 칸 편집

- **한 글자 한 칸**, **가로쓰기**(왼→오, 행 위→아래). 타이핑하며 칸이 채워지고 커서가 칸 단위로 이동.
- 모든 문자(한글/영문/숫자/문장부호/공백)가 **정확히 한 칸**을 차지. 칸 경계에서 자동 줄바꿈.

### 4-3. 규격 선택 (보기 메뉴, 영속)

| 규격 | 총 칸 | 행 × 칸(열/행) |
|---|---|---|
| 200자 | 200 | 20행 × 10칸 |
| 400자 | 400 | 20행 × 20칸 |
| 600자 | 600 | 30행 × 20칸 |
| 800자 | 800 | 40행 × 20칸 |
| 1000자 | 1000 | 50행 × 20칸 |

> 주의: 200자만 한 줄 10칸, 나머지는 한 줄 20칸(사용자 명시 규격). 구현은 `{chars, rows, cols}` 설정 테이블로.

### 4-4. 매수 카운터

- **타이틀바 상시** — 글자수 옆 `N.N매` 칩. 연속·원고지 모드 모두 표시.
- **기준 = 선택 규격**(사용자 확정). 매수 = 칸 사용 수 / 선택 규격. 예: 400자 원고지에서 800자 = 2.0매, 200자 원고지면 같은 글이 4.0매.
- **칸 사용 수** = 공백·문장부호 포함 표시 글자 수(줄바꿈 제외). 기존 `wordCount`(공백 제외)와 별개의 셈이 필요.

### 4-5. 빌드 구조 = PoC 게이트 (사용자 확정)

1. **PoC 스파이크 (gate)** — 라이브 칸 편집 + 한국어 IME 4케이스 + 모든 문자 1칸 정렬 + 칸 경계 자동 줄바꿈을 작은 범위로 검증.
   - 권장 기술 방향: **정상 에디터 DOM 유지 + CSS로 전각 고정폭 강제 + 배경 격자 정렬**(커스텀 ProseMirror 노드뷰 회피 → IME가 정상 텍스트 흐름에 남음). PoC가 이 방향의 실제 가능 여부를 판정.
   - **RED(IME 깨짐/정렬 실패)면 멈추고 사용자와 격자 방식 재논의.** 추측으로 정식 구현 진입 금지.
2. **PoC GREEN → 정식 구현**: 원고지 격자 모드 + 규격 선택 + 매수 카운터.

---

## 5. 기술 / 데이터

- Desktop, **backend 없음**. node:sqlite(Node 24) + Electron(`electron/` main·preload·db) + renderer(`src/`, React 19 + TipTap).
- **본문 저장 포맷 불변**(ProseMirror JSON). 격자는 **표현(CSS)만** — 저장 데이터에 칸/규격 정보를 넣지 않는다(009 "표현만" 패턴 정합).
- 모드(`연속`/`원고지`)·규격은 **`app_settings`** 로 영속(테마/자동저장과 동일 메커니즘). **DB 스키마 변경 없음.**
- 매수 = 표시 글자 수(공백·부호 포함, 줄바꿈 제외) / 선택 규격. 순수 함수로 분리(`lastSentence` 패턴 참고).

---

## 6. 범위 / 비범위

**범위(본 기능):** 본문 보기 모드 선택(연속/원고지) · 라이브 칸 편집 원고지 격자(가로쓰기) · 규격 5종 선택 · 매수 카운터(타이틀바 상시) · PoC 게이트 · 접근성(격자선 대비/focus) · 변경 화면 SC-006 재측정.

**비범위(후속):**
- **② A4 페이지뷰**(쪽 분할 + ◀▶ 이동) — 별도의 페이지네이션 위험. **다음 phase로 분리**(핵심은 ①).
- **세로쓰기 원고지** — `writing-mode: vertical-rl` + 라이브 IME 난이도 최고. 가로쓰기로 확정.
- **작품별 모드/규격 설정** — 앱 전역으로 시작. 필요성 확인 후 후속.
- **정통 칸 채움의 ProseMirror 커스텀 노드뷰** — PoC가 CSS 방향으로 충분하면 불요. PoC 결과 따름.
- **데이터 모델/IPC/스키마 변경** — 없음(표현·설정만).

---

## 7. 검증 (성공 기준)

### 7-1. PoC 스파이크 성공 기준 (gate)

1. 한국어 IME 4케이스(빠른 타자 / 조합 중 mark / 한자 변환 / Backspace 자모 삭제) 라이브 칸 편집에서 **조합 깨짐 0**.
2. 모든 문자(한글/영문/숫자/문장부호/공백)가 **정확히 한 칸** 정렬.
3. 칸 경계에서 **자동 줄바꿈** 정상.
4. 커서·Backspace가 칸 단위로 자연 동작.

→ 위 4건 GREEN이어야 정식 구현 진입. RED면 stop + 재논의.

### 7-2. 정식 구현 성공 기준

1. 자동화: `vitest` / `tsc --noEmit` / `vite build` GREEN(Node 24).
2. 보기 메뉴에서 연속↔원고지 전환 + 규격 5종 전환, 재시작 후 영속(`app_settings`).
3. 매수 카운터: 글자 입력 시 `N.N매`가 선택 규격 기준으로 갱신(순수 함수 단위 테스트).
4. 대비: 변경 화면(집필·원고지)의 격자선·본문·매수 칩 WCAG AA(OKLCH→대비비 재측정, `docs/qa/2026-06-06-009-contrast-measurement.md` 방식).
5. 한국어 IME 회귀 4케이스 재확인(원고지 모드).

---

## 8. 열린 결정 (구현/PoC 진입 시 확정)

1. **CSS 전각 고정폭의 실제 가능 범위** — PoC가 판정. 반각 문자(영문/숫자/부호)를 전각 칸에 정렬하는 방식(폰트 `font-variant-east-asian: full-width` / 고정 `width` / `ch` 단위 등) 중 무엇이 IME와 충돌 없이 동작하는지.
2. **문단 줄바꿈의 칸 처리** — 문단(엔터) 시 남은 칸을 비우고 새 행으로 갈지, 칸 채움 규칙. PoC/구현 단계 확정.
3. **매수의 칸 사용 수 정의 경계** — 줄바꿈/빈 문단을 칸으로 셀지. 단위 테스트로 고정.

---

## 부록 — 브레인스토밍 목업 참조

- 세 해석 비교(격자/페이지뷰/매수): `.superpowers/brainstorm/14474-1780750865/content/scope.html`
- 격자 충실도(배경형 vs 칸 채움형): `grid-fidelity.html`
- 쓰기 방향(가로 vs 세로): `orientation.html`
- 규격·매수 모델: `sheet-size.html`

> 목업은 방향 확정용 스케치다. 색·폰트·치수는 `docs/DESIGN.md` 토큰을 SoT로 재매핑한다(`--paper` / 고운바탕 / 격자선은 `--hairline` 계열).
