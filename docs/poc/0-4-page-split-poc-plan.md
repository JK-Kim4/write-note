# PoC 0-4 — 집필 에디터 "실시간 진짜 페이지 분할" 방향 결정 (3안 비교 계획서)

- 작성일: 2026-06-07
- 상태: **계획만** (실제 PoC 착수는 다음 단계로 분리 — 사용자 확정)
- 목적: 무료 경로 안에서 "실시간 진짜 페이지 분할 + 한글 IME 안전"을 만들 구현 방향을, **작은 PoC 3건**으로 RED/GREEN 판정해 결정한다.
- 선행 결정 (본 세션 사용자 확정):
  - 산출물 = 본 계획 문서 1건. 구현 착수는 다음 단계.
  - 분할 시점 합격선(지연 수용 vs 실시간만) 최종 판정 = PoC 결과 후. 단, **새 3안은 셋 다 실시간 분할이 목표**라 공통 게이트는 실시간으로 둔다(§1).

---

## 0. 배경 — 왜 다시 PoC인가

### 0-1. 양보 불가 핵심 (변함없음)

집필 본문이 **A4 한 장을 채우면 실제로 다음 장으로 넘어가고**, 장 사이에 **책상색 여백**이 있으며, **엔터 없이 한 문단을 길게 써도 문단 한가운데 줄에서** 다음 장으로 흐른다. 타이핑하는 **내내 실시간**으로. **한글 IME 가 절대 안 깨진다.** (메모리 `desktop-pagination-mandatory` = 사용자 양보 불가.)

### 0-2. 직전 회고 교훈 (이번 계획에 박은 가드레일)

`docs/retrospectives/2026-06-07-custom-editcontext-editor-objective-drift.md` (목표 상실 → 전량 폐기):

- **핵심(분할+한글)을 첫 dogfoodable 산출물에서 증명** — 범용 편집 엔진(서식·undo·저장결선)을 먼저 짓는 분해 금지. (`agent-workflow-discipline.md` §10)
- **핵심 미검증 상태에서 멀티에이전트/풀 SDD/다수 커밋 금지** — 각 PoC 는 작게, 조기 브라우저 dogfooding 우선.
- **버그 보고는 "실재 확인"부터** — 스크린샷·로그 단편으로 근본원인 단정 금지.

→ 그래서 본 계획은 **셋 다 "분할되는 종이 + 한글"만 보는 최소 PoC** 로 잡았고, 서식·저장 매핑·범용 편집은 명시적으로 범위 밖으로 미룬다.

### 0-3. 소거 이력 (다시 파지 말 것 — `custom-editor-A-handoff.md` §2 실측)

| 시도 | 정체 | 결과 | 사유 |
|---|---|---|---|
| 데코레이션 spacer 분할 (`paginationPlugin.ts`) | contenteditable + `Decoration.widget` JS 재계산 | **RED** | 위치의존 데코 매변경 재계산 ↔ 한글 IME 조합 충돌 / phantom 분할 |
| 원고지·블록 데코 | contenteditable | RED | text-transform 자모분해 / 블록단위는 긴 문단 안 못 쪼갬 |
| Syncfusion DocumentEditor | 상용 JS canvas 워드엔진 | RED | canvas 자체 IME 가 한글 자모 분해 |
| LibreOffice WASM (ZetaOffice) | 브라우저 LibreOffice | RED | 한글 두부(폰트 미포함) + IME 미캡처, 무거움 |
| ONLYOFFICE/Collabora | 서버 워드엔진 | 부적합 | Docker 서버 필수(로컬우선·프라이버시 충돌) + DOCX 강제 |
| EditContext 자체 엔진 | 브라우저 네이티브 IME + 우리가 그리는 레이아웃 | **한글 GREEN** | `minimal.html` 실측: 겹받침 복잡음절까지 정상 조합, 커서 1개 |

**핵심 결론:** 자기가 직접 글자를 그리는 엔진(canvas·WASM)은 전부 한글이 깨진다(시스템 폰트·OS IME 미사용). **브라우저가 직접 그리는 텍스트(contenteditable / EditContext)만** 한글 정상. 단 contenteditable 실시간 분할의 함정은 **"분할을 어떤 메커니즘으로 하느냐"** 에 달려 있다(§0-5).

### 0-4. 제외한 선택지 (사용자 명시)

| 선택지 | 제외 사유 |
|---|---|
| **데코레이션 방식 재시도** (`paginationPlugin.ts` idle 전환 포함) | 이미 `Decoration.widget` + 측정/dispatch 로 RED. 같은 구조 반복 가능성 큼. ※ 이전 계획의 "idle 0.5초 debounce"안도 이 구조 위라 함께 제외. |
| **Paged.js / Vivliostyle** | live editor 가 아니라 **paged preview/print** 엔진. 집필 중 실시간 분할 목표와 결이 다름. (※ 필요 시 PDF export 전용으로만 후속 검토.) 현재 미설치. |
| **Tiptap Pages** (`@tiptap-pro/extension-pages`) | 기술적으로 "true page-based editing" 목표라 요구에 가장 근접하나 **유료(Pro)** — 비용 조건 불일치. 참고 기준으로만. |

### 0-5. 이번 3안의 공통 가설 — "분할 메커니즘"을 바꾼다

데코레이션 JS 재계산(RED)을 피하고, 분할 책임을 다른 메커니즘에 맡기면 IME 충돌을 피할 수 있는가? 세 후보:

| PoC | 분할 메커니즘 | IME 충돌 회피 가설 |
|---|---|---|
| 1. CSS multi-column | **브라우저 레이아웃 엔진** 이 overflow 를 다음 컬럼으로 흘림 | 입력 중 JS transform 0 → 충돌 원인 자체가 없음(가설) |
| 2. ProseMirror page node | overflow 블록을 다음 page 로 **증분 이동(structural transform)** | 조합 중 transform 금지 + compositionend 후에만 이동으로 회피(가설) |
| 3. custom plain-text | **입력(EditContext)과 표시(우리 렌더) 분리** | 표시 DOM 은 입력 surface 가 아니라 줄 단위로 나눠도 IME 무관(handoff 실측 GREEN) |

→ 1 은 가장 싸고, 2 는 제품 구조에 가장 가깝고, 3 은 한글이 이미 증명된 대안. 이 순서로 판정한다.

---

## 1. 공통 판정 게이트 (3 PoC 전부 동일 적용)

각 PoC 는 아래를 **브라우저 dogfooding** 으로 통과해야 한다. 하나라도 RED → 그 PoC 멈추고 다음 안.

1. **한글 IME 4케이스** (SoT: `docs/poc/0-1-tiptap-korean.md`)
   - ① 빠른 타자(조합 중 다음 자모) ② 조합 중 굵게(⌘B) 토글 ③ 한자 변환 ④ Backspace 자모 분해
   - **특히 페이지/컬럼 경계 줄에서** 위 4케이스가 안 깨져야 함(분할이 IME 를 건드리는지가 본 게이트의 핵심).
2. **실시간 분할 정확성**
   - 엔터 없이 한 문단을 길게 → 문단 한가운데 줄에서 다음 장으로 흐름.
   - 짧은 본문(예: 2~3글자)에 **phantom 분할 0** (종이 한가운데 엉뚱한 책상색 band 없음).
3. **커서 / 선택**: 경계를 넘는 커서 위치 정확, 드래그 선택이 경계 가로질러 정상.
4. **성능**: 긴 글 3~5장에서 버벅임 체감 없음, 입력 지연 없음.

> **합격선 두 갈래 기록** (최종 판정은 PoC 후): (a) **실시간 즉시 분할** = 양보 불가 본 게이트. (b) 만약 어느 PoC 도 실시간을 못 내면, "타이핑 멈춤 후 분할" 같은 지연 fallback 을 수용할지 그때 재논의. **이번 3안은 셋 다 실시간을 목표로 설계**되어 있으므로 1차 목표는 (a).

---

## 2. PoC 1 — CSS multi-column 기반 TipTap (최우선)

### 2-1. 정체 / 메커니즘
TipTap `EditorContent` 는 그대로 두고, `.ProseMirror`(또는 감싸는 wrapper)에 CSS multi-column 을 준다: `column-width: 210mm`(A4 폭) + `column-gap` + **고정 높이 컨테이너**. 그러면 브라우저 layout engine 이 본문을 채우다가 넘치면 **다음 "페이지 컬럼"으로 자동으로 흘린다.** 분할이 JS 재계산이 아니라 **브라우저 레이아웃** 이라는 점이 핵심.

### 2-2. 왜 1순위
- 구현 가장 빠름(2~3시간 RED/GREEN), **문서 모델(ProseMirror JSON) 무변경**, 저장 결선 그대로.
- 입력 중 JS transform 이 없으므로(브라우저가 흘림) **데코레이션 RED 의 원인(매변경 재계산 ↔ IME)이 구조적으로 없을 가능성**. 실패해도 비용 작음.

### 2-3. 작업 범위 (최소)
- 하니스: `vite.poc.config.ts`(브라우저, 포트 5234) 재사용. `PocApp` 류 최소 화면에 TipTap StarterKit + CSS 컬럼 wrapper.
- 컬럼 높이 = A4 본문 높이(px). 장 사이 책상색 여백·페이지 경계선은 `column-gap` + 배경/`column-rule` 로 외관 처리.
- 페이지 번호·"종이 여러 장" 외관은 **PoC 에선 최소만** — 본 게이트(한글·분할·커서)부터.

### 2-4. 검증 절차
공통 게이트(§1) + 추가:
- 커서가 **컬럼 경계를 넘어갈 때** 위치가 정확한가(다음 컬럼 맨 위로 자연 이동).
- 드래그 선택이 컬럼을 **가로질러** 정상인가.
- 스크롤/페이지 번호를 컬럼 인덱스에 매핑 가능한가.

### 2-5. 리스크 (모두 **검증 대상** — 단정 아님)
- contenteditable + CSS multicol 에서 **커서/selection 이 컬럼 경계에서 불안정**하다고 일반적으로 알려져 있음 → 본 PoC 의 1순위 확인점.
- 한글 IME 조합이 **경계 줄에서** 흔들릴 가능성.
- **"종이 여러 장 수직 스택" 외관 만들기가 까다로움** — multicol 은 기본 수평 흐름(컬럼이 옆으로). 세로로 쌓인 A4 처럼 보이려면 추가 레이아웃/스크롤 전략 필요.
- 페이지 번호·스크롤 위치 매핑.

### 2-6. 판정
- **GO:** 한글 4케이스 GREEN + 커서/selection 경계 안정 + 입력 중 자동 분할 동작.
- **NO-GO:** 경계에서 커서/IME 깨짐 또는 의도한 외관 자체가 불가.
- **time-box: 2~3시간.** (가장 싸므로 빠르게 RED 판정하고 손절 가능.)

---

## 3. PoC 2 — ProseMirror schema 에 page node (제품 구조 근접)

### 3-1. 정체 / 메커니즘
페이지를 **장식이 아니라 문서 구조**로 만든다. schema 를 대략 `doc -> page+ -> block+` 로 두고, 입력 후 현재 page 의 content 높이가 넘치면 **overflow 블록을 다음 page 로 이동**한다. 핵심은 전체 문서 재계산이 아니라 **현재 page + 다음 page 만 증분 재배치**.

### 3-2. 왜 이 순서 (제품 근접)
- 진짜 페이지 구조 → 각 page 가 DOM node → **"종이 장" UX** 를 만들기 좋음.
- TipTap/ProseMirror **저장 모델과 연결 가능**(현 `bodyJson`). 무료 경로 중 최종 제품에 가장 가깝다.

### 3-3. PoC 범위 (최소 — 신중)
- **plain paragraph 만** (bold/list/table 없음).
- overflow 시 **현재 page 의 마지막 paragraph 를 다음 page 로 이동.**
- undo/redo·selection mapping 은 최소만 확인(완전 구현은 후속).

### 3-4. 작업 범위
- TipTap `Node.create` 로 `page` node 정의 + `appendTransaction`(또는 plugin)으로 overflow 감지·블록 이동.
- 높이 측정 = `nodeDOM(offset).offsetHeight`.
- **조합 중(`view.composing`) transform 절대 금지** — `compositionend` + `requestAnimationFrame` 후에만 이동.

### 3-5. 핵심 리스크 (1차 출처 있음)
- **ProseMirror 저자 Marijn:** "위치의존 처리 매변경 재계산 ↔ CJK IME = inherent incompatibility" (discuss.prosemirror.net, handoff 인용). page node 이동 = **입력 중 structural transform** → 조합 중에 돌면 한글 자모 깨짐이 1순위 위험.
- **selection mapping** — 블록이 page 사이로 이동할 때 커서가 정확히 따라가야 함.
- **undo/redo 일관성** — 사용자 입력 transform 과 자동 이동 transform 이 history 에서 엉키지 않아야 함.
- → 완화: 조합 중 금지 가드 + 증분(현재+다음 page 만) + 이동 로직 단위 테스트.

### 3-6. 검증 절차
공통 게이트(§1) + 추가:
- **조합 중 page 경계를 넘기는 순간** 한글이 안 깨지는가(최대 난점).
- overflow 시 마지막 문단 이동 + 커서가 따라가는가.
- Backspace 로 page 가 합쳐지는가(역방향).
- undo/redo 가 일관적인가.

### 3-7. 판정
- **GO:** 한글 GREEN(조합 중 경계 포함) + 증분 이동 정확 + 커서/undo 일관.
- **NO-GO:** 조합 중 transform 이 IME 를 깸 또는 selection/undo 가 깨짐.
- **time-box: 1~2일.** (PoC 라도 transform 정책이 핵심 난이도 — 신중히.)

---

## 4. PoC 3 — custom plain-text paged editor (2 불안정 시 진짜 대안)

### 4-1. 정체 / 메커니즘
TipTap 을 잠깐 빼고 **평문 전용** 에디터. 입력은 `textarea` / hidden `textarea` / `EditContext` 중 하나로 받고(handoff 실측: **EditContext 가 한글 GREEN**), React 가 텍스트를 **줄 단위로 측정해 A4 page 배열로 렌더**. rich text 없이 **한글 입력 + 실시간 페이지 분할 + 커서** 만 본다.

### 4-2. 왜 이 순서 (2 불안정 시 대안)
- contenteditable/ProseMirror 의 **재렌더 함정에서 벗어남**(입력↔표시 분리).
- "직접 엔진" 의 핵심 리스크를 **가장 작게** 검증. 2번(page node)이 조합 중 transform 으로 불안정하면 이쪽이 실재 대안.

### 4-3. 기존 재사용 자산
| 자산 | 내용 | 용도 |
|---|---|---|
| `src/poc/editcontext/minimal.html` | vanilla EditContext 단순 렌더 — **한글 GREEN·커서 1개 증명** | 출발점(정독) |
| `src/poc/editcontext/PaginatedEditor.tsx` | EditContext + `computePageBreaks` 분할 — 동작하나 phantom 버그 | 측정 로직 재설계 기준 |
| `src/poc/editcontext/editor.html` | vanilla 분할 시도(3대 버그) | "이렇게 하면 안 된다" 반례 |
| `src/poc/editcontext/editcontext.d.ts` | EditContext 최소 ambient 타입(TS 5.9 미포함) | 그대로 재사용 |
| `src/poc/pagination/computePageBreaks.ts`(+`.test.ts` 6) | **검증된 분할 순수함수** | 분할 계산 재사용 |

3대 버그 + 해결책(handoff §3): ① 커서 2개 → `caret-color: transparent` + 자체 커서 ② 조합 중 자모 깸 → `composing` 가드 + `compositionend` 후 재배치 + rAF ③ React 이중 마운트 → **vanilla 엔진 + 얇은 React 래퍼**.

### 4-4. PoC 범위 (최소)
- plain text, 고정 폰트/line-height, A4 pages, 한국어 IME 4케이스.
- **측정 로직 재설계** — 짧은 본문 분할 0 보장(단위 테스트), 조합 끝난 안정 상태에서만 측정.
- 커서/방향키는 거칠어도 OK(핵심 아님). 입력 surface(EditContext vs hidden textarea)는 PoC 에서 비교 가능 — handoff 는 EditContext 권장.

### 4-5. 검증 절차
공통 게이트(§1) 전부 + 실시간 즉시 분할 체감.

### 4-6. 판정
- **GO:** 한글 GREEN + 실시간 분할 정확 + phantom 0.
- **NO-GO:** phantom 못 잡음 또는 조합 중 깸.
- **GREEN 이어도 후속 별도 과제(범위 밖 명시):** rich text, selection, clipboard, undo/redo, **ProseMirror JSON ↔ 평문 변환**(저장 포맷, §7).
- **time-box: 1~2일.**

---

## 5. 진행 순서 & 의사결정 트리

```
PoC 1 (CSS multi-column, 2~3h)
  ├─ GREEN → 가장 싸게 해결. 외관/페이지번호 보강 후 채택 검토.  ★조기 종료 가능
  └─ RED  → PoC 2 진행
PoC 2 (ProseMirror page node, 1~2일)
  ├─ GREEN → 최종 제품 구조에 가장 가까운 후보. 본 빌드 spec 진입.
  └─ 조합중 transform IME RED / selection·undo 불안정 → PoC 3 진행
PoC 3 (custom plain-text, 1~2일)
  ├─ GREEN → 자체 엔진 빌드(rich text·저장변환 등 후속과제 명시 + 저장포맷 컨펌).
  └─ RED  → 멈추고 재논의(저장포맷·범위·지연 fallback 수용 여부).
```

- **각 단계 dogfooding GREEN 전, 다음 안 멀티에이전트/풀 SDD/다수 커밋 금지** (회고 §10).
- 한 PoC 가 RED 면 즉시 멈추고 다음 안 — 라이브로 한 줄씩 패치 누적 금지.

---

## 6. 검증 환경 / 게이트

- 작업 디렉토리: `cd desktop`
- Node 24 (EditContext = Chromium 121+, `node:sqlite`): `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` → `node -v`(v24 확인)
- 브라우저 PoC: `node_modules/.bin/vite --config vite.poc.config.ts`(5234) / `vite.poc-editcontext.config.ts`(5236) — Electron 없이 빠른 dogfooding.
- 검증 명령은 **포어그라운드** (CLAUDE.md "빌드/테스트 포어그라운드 의무"): `node_modules/.bin/{vitest,tsc,vite}`.
- 기준선: 현재 vitest GREEN 유지 + `tsc --noEmit` + `vite build` 회귀 금지. 줄노트 개선(`968b0e0`) 보존.
- 한글 IME 회귀 SoT: `docs/poc/0-1-tiptap-korean.md`.

---

## 7. 미해결 / 사용자 컨펌 영역

- **저장 포맷** — 현 앱은 `documents.bodyJson`(ProseMirror JSON). PoC 1·2 는 그대로 유지. **PoC 3(평문 모델)이 GREEN 일 때만** ProseMirror JSON ↔ 평문 매핑 또는 스키마 변경 결정 필요. **DB 스키마 변경은 사용자 컨펌**(`external-infra-safety.md`).
- **실시간 vs 지연 최종 판정** — §1 두 합격선. 1차 목표는 실시간. 어느 PoC 도 실시간을 못 낼 경우에만 지연 fallback 재논의.
- **서식(굵게·제목·인용·목록, 현 BubbleMenu)** — v1 범위 밖. 분할 GREEN 이후 결정.

---

## 8. 참조

- 핸드오프(소거 결론·아키텍처·3대 버그): `docs/handoff/2026-06-07-custom-editor-A-handoff.md`
- 회고(목표 상실): `docs/retrospectives/2026-06-07-custom-editcontext-editor-objective-drift.md`
- 가드레일: `.claude/rules/shared/agent-workflow-discipline.md` §10 / `.claude/rules/typescript/code-quality.md`(한국어 IME cadence)
- 현재 집필 구조: `desktop/src/components/Editor.tsx`(TipTap+BubbleMenu, bodyJson) · `screens/WriteStudioScreen.tsx`
- 목표 외관 목업: `docs/design/desktop/page-split-build-modes.html` · `page-modes.html`
- 메모리: `desktop-pagination-mandatory`

---

## 9. PoC 1 판정 + 확정 요구사항 (2026-06-07)

**판정: PoC 1 = GO (사용자 확정).** 브라우저 실측 GREEN — 실시간 세로 분할(`column-wrap`) + 한글 IME 4케이스 + 줄노트 정렬 + 페이지 경계 줄 단위 끊김. **PoC 2·3 진행 불필요.** PoC 산출물: `desktop/src/poc/multicolumn/` (포트 5238).

**검증된 환경 사실:** `column-wrap`/`column-height` = Chrome 145+. 제품 = Electron 42 = Chromium 148 → 지원. (이전 "multicol 가로뿐" 통념은 이 신규 기능으로 무효.)

**확정 요구사항 (인터뷰):**

| # | 결정 | 구현 함의 |
|---|---|---|
| 분할 모드 | **항상 실시간 분할**(토글 없음) | 렌더 경로 1개. 연속/페이지보기 분기 없음 |
| 서식 범위 | **제목·목록 등 허용 + 줄 높이를 줄 격자(`--line`=34.56px) 정수배로 스냅** | 모든 블록(heading/list/blockquote)의 line-height·세로 margin 을 `--line` 배수로. heading 은 `break-inside: avoid`(장 사이 안 쪼개짐) |
| 쪽 번호 | **각 장 하단에 쪽 번호** | 페이지마다 하단 번호(968b0e0 하단 번호의 페이지별 확장) |
| 종이 외관 | **진짜 A4(210mm, 좌우 25mm 여백 포함)** | 컬럼=본문 160mm + 좌우 여백 = 종이 210mm. 종이/책상 띠 배경 정렬 |

**핵심 제약(유지):** 페이지 높이·간격 = 줄 높이 정수배(PoC: 한 장 26줄 + 간격 3줄). 저장 포맷(ProseMirror JSON `documents.bodyJson`) 불변. 줄노트(968b0e0) 회귀 금지. 한글 IME 4케이스 = 하드 게이트.

**통합 대상:** 현 프로덕션 `desktop/src/components/Editor.tsx`(현재 `A4_PAGE_PX` 로 페이지 수만 셈) + `styles/app.css`. zoom·줄노트·BubbleMenu·저장 결선 보존. → 구현 계획은 별도 작성.

---

## 10. 저장 / 쪽 번호 설계 (2026-06-07 인터뷰)

**현재 저장:** desktop 로컬 `node:sqlite`, `documents.body_json` = ProseMirror JSON(TEXT, Postgres JSONB 아님). **문서 1개 = 본문 1덩어리, 페이지 개념 없음.**

**핵심 결정: 저장 구조 불변(연속 JSON 1덩어리). 페이지는 렌더 시 계산(시각).** 사용자 목적 4개 모두 이 위에서 충족:

| 목적 | 설계 | 저장 영향 |
|---|---|---|
| #1 쪽 이동·표시·참조 | 고정 A4 레이아웃 → 렌더 시 **파생 '쪽 색인'**(위치→쪽). "N / 총 M쪽", 쪽 이동 | 없음(계산값) |
| #2 메모→위치 연결 | 메모를 **문서 위치 앵커**에 연결(쪽 아님 — 수정에 안정). 표시 시 파생 색인으로 "N쪽" | `memo_projects` 에 앵커 추가(별도 phase) |
| #3 페이지=독립 저장 단위 | **철회**(사용자 확정) — 자동 분할과 충돌. #1·#2 로 대체(쪽 참조면 충분) | 없음 |
| #4 출력 쪽 번호 | export/인쇄 시점 처리 | 없음 |

**근거(유지):** 자동 실시간 분할이면 쪽 경계는 유동 → 쪽은 고정 앵커가 아님(수정 시 밀림). 영속 연결(메모 등)은 **문서 위치 앵커**로. 단 고정 A4 geometry(종이 항상 210mm + 줌=시각 배율)면 쪽 번호는 주어진 문서 상태에 대해 결정적 → 안정적 표시 가능.

**스코프/순서 (회고 §10 — 핵심 먼저, dogfoodable 우선):**
- **Phase 1 (핵심):** CSS `column-wrap` 분할을 프로덕션 `Editor.tsx` 에 통합(§9 요구사항 4건). 저장 불변. ← 첫 dogfoodable 산출물.
- **Phase 2:** 파생 쪽 색인 + 네비게이션(#1 — "N/총M쪽", 쪽 이동).
- **Phase 3:** 메모 문서 위치 앵커(#2 — 메모 시스템·스키마 touch).
- #4 출력 쪽 번호 = export 기능 도입 시점(현 스코프 밖).
