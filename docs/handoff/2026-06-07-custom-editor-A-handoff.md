# 새 세션 핸드오프 — Desktop 집필 "진짜 페이지 분할" = 자체 EditContext 에디터(A안) 제대로 빌드

> **용도:** Desktop write-note 집필 화면의 **실시간 진짜 페이지 분할(A4 장 단위 실제 분할 + 장 사이 책상색 여백 + 엔터 없는 긴 문단도 줄 단위로 다음 장에 흐름)**을, **자체 EditContext 기반 에디터**로 새 세션에서 제대로 구현하기 위한 핸드오프. 사용자가 "실시간 진짜 분할 = 절대 양보 불가 핵심 기능"으로 확정했고, 소거법으로 **A안(자체 엔진)이 유일한 길**임이 실측·조사로 확정됨. §kickoff 프롬프트를 새 세션 첫 입력으로 붙여넣으면 된다.
>
> **작성일:** 2026-06-07
> **기준 브랜치:** `develop` (HEAD = 줄노트 개선 `968b0e0` + 핸드오프 `550211a` 계열. 이번 세션 산출물은 `src/poc/**` PoC 파일 + 본 문서, 아직 커밋 안 했을 수 있음 — git status 확인)
> **직전 핸드오프:** `docs/handoff/2026-06-07-pagination-handoff.md`(원래 진입점). 본 문서가 그 후속·상위.

---

## 0. 한 줄 요약

3개월 안 걸릴 결론: **"서버 없이 한글 IME + 실시간 진짜 페이지 분할"을 동시에 하는 길은 자체 EditContext 엔진(A)뿐이다.** 다른 모든 길(TipTap·Syncfusion·LibreOffice WASM·ONLYOFFICE)은 이번 세션에 실측/조사로 막혔다. EditContext 에서 **한글 조합은 이미 GREEN(증명됨)**, **페이지 분할 로직도 동작**. 남은 건 이 둘을 **커서·선택·조합-안전 재배치까지 안정적인 에디터로 제대로 조립**하는 것 — 라이브 패치 말고 설계부터.

---

## 1. 목표 (변함없음)

집필 화면 본문이 **A4 한 장을 채우면 실제로 다음 장으로 넘어가고**, 장 사이에 **책상색 여백**이 있으며, **엔터 없이 한 문단을 길게 써도 문단 한가운데 줄에서** 다음 장으로 자연스럽게 흐르는 효과. 타이핑하는 **내내 실시간**으로. (사용자 필수·양보 불가.)

---

## 2. 이번 세션에서 실측·검증한 것 (같은 길 다시 파지 말 것)

| 시도 | 정체 | 결과 | 사유 |
|---|---|---|---|
| TipTap 분할(원고지/블록/줄 데코) | 기존 contenteditable 에디터 | **RED** | 원고지 text-transform 자모분해 / 블록단위는 긴 문단 안 쪼개짐 / 줄단위 데코는 IME↔decoration 충돌 |
| **Syncfusion DocumentEditor** | 상용 JS **canvas** 워드엔진(무료 Community·npm 임베드·서버X) | **RED** | 한글 자모 분해 + 엔터 시 마지막 글자 다음줄 튐. canvas 자체 IME 가 한글 못 다룸 |
| **LibreOffice WASM (ZetaOffice)** | 브라우저서 도는 LibreOffice(서버X) `zetaoffice.net/demo1.html` | **RED** | 한글 **두부(□, 한글폰트 미포함)** + IME 미캡처(생QWERTY "dkssuid"). 무거움(수십~수백MB) |
| ONLYOFFICE / Collabora | 서버 기반 워드엔진 | 데스크탑 부적합 | Docker 서버 필수 → 사용자 설치부담 or 원격호스팅(로컬우선·프라이버시 본질 충돌) + DOCX 강제 |
| **A. 자체 EditContext 엔진** | 브라우저 네이티브 IME + 우리가 그리는 레이아웃 | **유일 GREEN 경로** | 아래 §3 |

### 핵심 결론 (소거 완료 — 1차 출처 포함)
- **자기가 직접 글자를 그리는 엔진(canvas·WASM)은 전부 한글이 깨진다** — 시스템 한글 폰트도, OS 한글 IME 도 안 타기 때문. (Syncfusion·LibreOffice WASM 둘 다 같은 원인.)
- **오직 브라우저가 직접 그리는 텍스트(contenteditable / EditContext)만** 시스템 폰트 + OS IME 를 그대로 써서 한글이 정상.
- contenteditable 은 페이지네이션을 구조적으로 못함(Google Docs 원저자 Steve Newman "no sane way" → canvas 이주 / ProseMirror 저자 Marijn "위치의존 decoration 매변경 재계산 ↔ CJK IME = inherent incompatibility", discuss.prosemirror.net/t/.../2452·1547·6336).
- → **남는 건 EditContext(브라우저 네이티브 IME) + 우리가 직접 그리는 레이아웃**. 입력과 표시를 분리하면 표시 DOM 을 줄 단위로 나눠도 IME 와 무관 → 페이지 분할이 IME-안전.

---

## 3. A안 아키텍처 (다음 세션 시작 설계)

```
┌─ 입력 레이어 ───────────────────────────────┐
│ focusable 요소 + EditContext(브라우저 네이티브 IME)│
│ ec.text(평문, \n 포함) = 텍스트 source of truth   │
│ ec.selectionStart/End = 커서/선택               │
│ → 한글 조합 OS IME 그대로 = 안 깨짐(증명됨)        │
└────────────────────────────────────────────┘
            │ textupdate / compositionstart·end
            ▼
┌─ 표시 레이어 (우리가 그리는 읽기전용 DOM) ──────────┐
│ ec.text 를 우리가 렌더. 입력 surface 가 아니므로     │
│ 줄 단위로 자유롭게 나눠도 IME 무관(← 분할의 열쇠)     │
│ • 줄 측정(getClientRects) → A4 경계 넘는 줄 찾기     │
│ • 그 줄 '앞'에 책상색 여백 spacer 삽입 = 페이지 분할  │
│ • computePageBreaks(검증된 순수함수) 재사용          │
│ • 커서/선택은 우리가 그림(네이티브는 숨김)            │
└────────────────────────────────────────────┘
```

### 이미 규명된 3대 버그 + 해결책 (라이브 패치 말고 설계에 박을 것)
1. **커서 2개** = EditContext 붙은 요소에 **브라우저 네이티브 커서 + 내가 그린 커서**가 중복.
   → 해결: 요소에 `caret-color: transparent`(네이티브 숨김) + 내 커서만 그림.
2. **조합 중 한글 자모 깨짐** = 내 무거운 재배치(줄 측정 = `getBoundingClientRect`/`caretRangeFromPoint` = 강제 reflow + DOM 재구성)가 **조합 중에 실행**돼 IME 를 방해.
   → 해결: `composing` 플래그. **조합 중엔 가벼운 렌더만**(한 덩어리 표시 + 커서), **페이지 분할 재배치는 `compositionend` 후**에. 모든 측정은 `requestAnimationFrame` 으로 coalesce, textupdate 핸들러에서 동기 측정 금지.
3. **React StrictMode/HMR 이 EditContext 이중 마운트** → 커서 2개 + 입력이 둘로 갈려 자모 분해.
   → 해결: **엔진을 vanilla 모듈(`createEditor(container)`)로** 만들고 React 는 얇게 감싸기(useEffect 1회 마운트, StrictMode 미사용, 단일 init 가드). TipTap·Monaco·CodeMirror 가 쓰는 표준 패턴.
4. **페이지 분할 spacer 배치 부정확(editor.html 실측)** — 짧은 본문(예: "ㅇㄴ" 2글자)에도 **phantom 분할**이 생기고 종이 한가운데 얇은 책상색 band 가 엉뚱하게 낌(페이지가 제대로 안 나뉨).
   → 원인: 줄 측정(`getClientRects` + `caretRangeFromPoint` 로 줄→글자 offset 매핑 + `PAGE_PX` usable 높이 기하)이 **조합 상태/측정 타이밍에 취약**해 phantom 줄·잘못된 offset 을 만든다.
   → 해결(정식 빌드): 줄 측정 로직을 처음부터 재설계 — **조합이 끝난 안정 상태에서만 측정**, offset 매핑을 단위 테스트로 검증, 짧은 본문은 분할 0 보장(경계 케이스 테스트). editor.html 의 측정 코드는 "이렇게 하면 안 된다"는 반례로만 참조.

### 증거: vanilla 단순 렌더는 GREEN
`src/poc/editcontext/minimal.html`(React 없음, 단순 textContent 렌더, rAF 지연 측정) 에서 **"한글을 직접 타이핑", "가나다라마바사아" 등 음절 정상 조합 + 커서 1개** 확인됨. = **자체 엔진 토대는 GREEN**, 조립이 작업.

### 저장 포맷 — 설계 결정 필요 (HARD-GATE)
현재 앱은 본문을 **ProseMirror JSON(`documents.bodyJson`)** 으로 저장. 자체 엔진은 평문(\n) 모델. 새 세션에서 **확정**할 것:
- (a) v1 평문 저장 + 기존 JSON ↔ 평문 매핑(서식 없는 프로즈), 또는
- (b) ProseMirror JSON 을 모델로 유지하고 거기서 렌더.
- 서식(굵게/제목/인용/목록, 현재 BubbleMenu)은 **v1 범위 밖으로** 두고 나중에 결정 권장(프로즈 우선). DB 스키마 변경은 사용자 컨펌.

---

## 4. 단계별 빌드 계획 (제대로 — 라이브 X)

1. **엔진 코어(vanilla)** — EditContext 입력 + 우리 렌더 + 커서 + 선택(드래그/shift) + 화살표(상하좌우) + 클릭 커서 + Enter/Backspace. **한글 100% 안정(조합 중 재배치 금지)**. 순수 로직(offset↔위치 매핑 등)은 TDD. → dogfooding: 한글 4케이스 + 빠른타자 + 커서/선택.
2. **페이지 분할** — 줄 측정 + 줄 단위 page-break spacer(문단 중간 OK). `computePageBreaks` 재사용. → dogfooding: 엔터 없는 긴 문단이 줄에서 분할 + 한글 동시 GREEN.
3. **React 통합(얇게)** + 실제 앱 `Editor.tsx`/`WriteStudioScreen` 결선 — 줄노트(가로 줄선)·페이지 번호·저장 포맷 보존. SC-006 대비 재측정.
4. **(후속) 서식** — 필요 시 BubbleMenu 류. v1 이후.

각 단계 끝에 **작은 dogfooding** 으로 한글·분할·커서 조기 검증. RED 면 멈추고 재논의(라이브 패치 누적 금지).

---

## 5. 가드레일 (반드시 준수)

- **한글 IME = 하드 게이트.** 입력은 무조건 EditContext(브라우저 네이티브). canvas/WASM 자체 IME 금지(전부 RED 확인). 4케이스(빠른타자/조합중 서식/한자/Backspace 자모) + 커서.
- **커서 1개** — `caret-color: transparent` + 자체 커서. 네이티브와 중복 금지.
- **조합 중 무거운 작업 금지** — `composing` 가드, rAF coalesce. (자모 깨짐 1순위 원인.)
- **vanilla 엔진 + 얇은 React 래퍼** — StrictMode/HMR 이중 마운트 회피.
- **저장 포맷(ProseMirror JSON)/DB 스키마** — §3 설계 확정 전 변경 금지, 변경 시 사용자 컨펌(외부 인프라 안전 룰).
- **줄노트 개선(`968b0e0`) 보존** — 회귀 금지.
- **검증 게이트:** `cd desktop` + `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"`(Node 24, `node:sqlite`) → `node_modules/.bin/{vitest,tsc,vite}` **포어그라운드**. 현재 vitest **166 GREEN**(기존 160 + `computePageBreaks` 6). tsc/build GREEN.
- **PoC 작게 + 조기 dogfooding**, 라이브 한 줄씩 패치 금지 — 설계부터.

---

## 6. 이번 세션 산출물 / 참조 (다음 세션이 재사용·정독)

| 경로 | 내용 | 다음 세션 용도 |
|---|---|---|
| `src/poc/editcontext/minimal.html` | **vanilla EditContext 단순 에디터 — 한글 GREEN, 커서 1개 증명** | **A 토대의 출발점(정독)** |
| `src/poc/editcontext/editor.html` | vanilla 페이지 분할 시도(3대 버그 있음, 원인 규명됨) | 분할 재배치 로직 참조 + §3 버그 회피 |
| `src/poc/editcontext/PaginatedEditor.tsx` / `EditContextPoc.tsx` | React 버전(StrictMode/HMR 이중마운트 버그) | 왜 vanilla 로 가야 하는지 반례 |
| `src/poc/editcontext/editcontext.d.ts` | EditContext 최소 ambient 타입(TS 5.9 lib 미포함) | 그대로 재사용 |
| `src/poc/pagination/computePageBreaks.ts` (+ `.test.ts` 6) | **검증된 페이지 분할 순수함수** | **분할 계산 그대로 재사용** |
| `src/poc/pagination/paginationPlugin.ts` 등 | TipTap 줄/블록 분할 PoC(RED) | 참조(왜 contenteditable 이 안 되는지) |
| `docs/design/desktop/page-split-build-modes.html` | 실시간 분할 vs 페이지보기 모드 UX 목업 | 목표 외관 참조 |
| `vite.poc-editcontext.config.ts` / `vite.poc.config.ts` | PoC 전용 vite(Electron 없이 브라우저 띄움, 포트 5236/5234) | 빠른 dogfooding |

- Syncfusion 의존성은 **설치 후 RED 확인하고 제거**됨(package.json/lockfile clean).
- 정리 판단: 위 PoC 파일들은 **참조 가치 있어 보존 권장**. 정식 엔진은 별도 위치(예: `src/editor/` 또는 spec 디렉토리)에 새로 빌드. 본 repo SDD 컨벤션(`specs/NNN-...`)대로 새 번호로 진행할지 사용자와 확정.

---

## 7. 시작 순서 (제안)

1. 본 문서 + `src/poc/editcontext/minimal.html`(한글 GREEN 토대) + `editor.html`(분할 시도·버그) + `computePageBreaks.ts` 정독.
2. 기준선 재확인: `cd desktop && export PATH=...v24.../bin:$PATH && node -v`(v24) → `node_modules/.bin/vitest run`(166 GREEN) + `tsc --noEmit` + `vite build`.
3. §3 **저장 포맷 결정**(평문 vs ProseMirror JSON) 사용자 확정 + (선택) SDD 풀파이프 진행 여부 확정.
4. §4 1단계: vanilla 엔진 코어를 **설계부터** 구현(§3 3대 버그 회피 박은 채) → 조기 dogfooding(한글·커서·선택).
5. GREEN → 2단계 페이지 분할 → 3단계 앱 통합. RED → 멈추고 재논의.

---

## 8. kickoff 프롬프트 (새 세션 첫 입력으로 복사)

```
Desktop write-note 집필 화면의 "실시간 진짜 페이지 분할"(A4 장 단위 실제 분할 + 장 사이 책상색 여백 + 엔터 없는 긴 문단도 줄 단위로 다음 장에 흐름)을, 자체 EditContext 기반 에디터(A안)로 제대로 구현한다. 사용자 양보 불가 핵심 기능. CLAUDE.md 와 .claude/rules 의 HARD-GATE 를 모두 따른다(추측 금지/단정 금지, 한국어, TDD, 빌드·테스트 포어그라운드, 외부 vault SoT, 한국어 IME 회귀 cadence). 라이브로 한 줄씩 패치하지 말고 설계부터 잡는다.

[0] 먼저 읽기:
- docs/handoff/2026-06-07-custom-editor-A-handoff.md  (본 작업 진입점 — 소거 결론·아키텍처·3대 버그 해결책·단계 계획·가드레일)
- src/poc/editcontext/minimal.html  (한글 조합 GREEN·커서 1개 증명된 vanilla EditContext 토대 — 출발점)
- src/poc/editcontext/editor.html  (vanilla 페이지 분할 시도. 3대 버그 있으나 원인 규명됨 — 핸드오프 §3)
- src/poc/pagination/computePageBreaks.ts (+ .test.ts)  (검증된 분할 순수함수 — 재사용)
- vault ~/obsidian/write-note/02-PROGRESS.md + 03-ISSUES.md  (진척·이슈, 답변 전 Read 의무)
- 현재 집필 구조: desktop/src/components/Editor.tsx · screens/WriteStudioScreen.tsx · styles/app.css (커밋 968b0e0)

[1] 기준선 재확인: cd desktop && export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" && node -v(v24) → node_modules/.bin/vitest run(166 GREEN 기대) + tsc --noEmit + vite build.

[2] 검증된 큰 결론(다시 파지 말 것): "서버 없이 한글 IME + 실시간 진짜 분할" = 자체 EditContext 엔진뿐. canvas/WASM(Syncfusion·LibreOffice WASM)은 시스템 폰트·OS IME 를 안 타서 한글이 전부 깨짐(실측 RED). contenteditable 은 페이지네이션 구조적 불가. EditContext(브라우저 네이티브 IME)만 한글 GREEN(minimal.html 증명).

[3] 아키텍처 = 입력은 EditContext(ec.text 평문 source of truth, 브라우저 네이티브 IME), 표시는 우리가 그리는 읽기전용 DOM(줄 단위로 나눠도 IME 무관 → 페이지 분할 IME-안전). 3대 버그는 이미 원인 규명+해결책 있음(핸드오프 §3): 커서2개→caret-color:transparent+자체커서 / 조합중 자모깨짐→composing 가드+compositionend 후 재배치+rAF / React 이중마운트→vanilla 엔진+얇은 React 래퍼. 저장 포맷(ProseMirror JSON vs 평문)은 구현 전 사용자와 확정.

[가드레일] 한글 IME 깨지면 즉시 RED(입력은 무조건 EditContext) / 커서 1개 / 조합 중 무거운 작업 금지 / vanilla 엔진+얇은 React / 저장 포맷·DB 스키마 변경 전 컨펌 / 줄노트(968b0e0) 회귀 금지 / Node24 포어그라운드 게이트 / PoC 작게+조기 dogfooding, 라이브 패치 금지.

먼저 [0] 읽고 [1] 기준선 보고 + 핸드오프 §3 저장 포맷 결정 질문 + SDD 진행 여부부터 확정하라. 그다음 §4 1단계(vanilla 엔진 코어)를 설계부터 시작.
```

---

## 부록 — 참조

- 직전 핸드오프(원래 진입점): `docs/handoff/2026-06-07-pagination-handoff.md`
- 줄노트 개선 커밋: `968b0e0`
- 한국어 IME 회귀 SoT: `docs/poc/0-1-tiptap-korean.md` + `.claude/rules/typescript/code-quality.md`
- EditContext: MDN `Web/API/EditContext_API/Guide` (Chromium 121+/Electron 가용)
- 소거 근거(조사): discuss.prosemirror.net 페이지네이션 스레드 / tiptap.dev Pages(유료) / zetaoffice.net(LibreOffice WASM)
- 메모리: `desktop-pagination-mandatory`(3 RED + 소거 결론 + A 3대 버그 해결책 박힘)
