# Desktop 작업실 디자인 고도화 — 작품 벽 · 서랍형 집필실 · 쪽지 책상 (작업 지시서)

> **용도:** 본 문서는 `speckit-specify` 입력 brief(SDD, Spec-Driven Development)다. 2026-06-06 브레인스토밍(impeccable critique → 물성 A/B → 흐름 목업 → 메모 화면)으로 확정한 **재진입 강화 재디자인**을 담는다. 이 문서를 근거로 `specs/NNN-.../`의 spec → plan → tasks → implement 를 생성한다.
>
> **메타**
> - 트랙: Desktop MVP (Electron 로컬 우선 앱). Phase 6(메모↔작품 연결) 완료 직후의 **디자인 고도화** — Phase 번호는 vault `02-PROGRESS.md` 확정 대기(Phase 7 후보).
> - 작성일: 2026-06-06
> - 기준 브랜치: `develop` (로컬 HEAD `893f0e7` — Phase 6 + 메모 연결 optimistic fix)
> - 상위 SoT: `PRODUCT.md`(전략) · `docs/DESIGN.md`(비주얼 토큰 §2~§8) · vault `02-PROGRESS.md`
> - 근거 산출물: `.impeccable/critique/2026-06-05T18-51-55Z__desktop-src-app-tsx.md`(critique 24/40) · `docs/handoff/2026-06-06-desktop-workshop-design-handoff.md`(방향 핸드오프) · 목업 `.superpowers/brainstorm/48729-1780686049/{workshop-flow,memo-desk}.html`

---

## 1. 목표

작가가 매 세션 다시 들어올 때 **"어디까지 했지"를 재구성하지 않게** 하는 것이 제품의 1차 가치(재진입 비용 0)다. 현재 UI 는 방향은 맞지만 아직 **생산성 앱 셸 / 관리 화면**의 존재감이 커서, "도구가 물러나는 작업실"이라는 약속을 일부 깬다(critique 24/40, P1 2건).

본 재디자인은 세 핵심 화면의 **정보 구조와 조작 밀도**를 "기능 모음"에서 "재진입을 돕는 작업실"로 바꾼다. 색·질감 같은 표면 장식이 아니라 **무엇을 먼저 보여주고 무엇을 숨기는가**로 작업실감을 만든다(핸드오프 §5 원칙).

비목표: 새 기능 추가, 데이터 모델 변경, AI 도입. 본 작업은 **기존 backend·스키마 위에서 renderer 표현/배치만 바꾼다.**

---

## 2. 배경 — 왜 재디자인인가 (critique + 사용자 피드백)

### 2-1. critique 핵심 (P1·P2)

| # | 우선 | 이슈 | 본 doc 의 해소 |
|---|---|---|---|
| P1 | 집필 화면의 visible decision points 과다 (레일·저장상태·zoom·줄노트·메모패널·설정 동시 노출) | **서랍형 집필실** — 평소 종이만, 보기/설정 control 은 서랍에 접힘 |
| P1 | 재진입 안도감이 구체적 맥락으로 미구현 (작품 카드가 제목·날짜만) | **작품 벽형** — 카드 얼굴 = 마지막 문장 + 다음 장면. 재진입 순간 서랍 한 장 펼침 |
| P2 | 빠른 메모 affordance 약함 (rail 하단 `+`, "새 항목"으로 오인) | **잉크 한 방울** — 캡처 전용 명명/아이콘 + 모달 hardening |
| P2 | 메모 inbox 가 "살아나는 메모"보다 "관리 화면" (필터·통계·연결·삭제·칩 동시) | **쪽지 책상** — 통계/카운터/필터 줄 제거, "어느 작품에 붙일까"가 중심 |
| P2 | 대비/focus 회복 미흡 (`--faint`/`--muted` 저대비, 전역 `outline:none`) | §7 접근성에서 토큰·focus 조정 |

### 2-2. 사용자 최신 피드백 (핸드오프 §2)

- "더 작업실답게"가 "더 실용적으로"보다 우선.
- 메모 흐름은 필요하지만 **"처리 queue"처럼 보이면 안 된다** — 작업대 위 자료, 오늘 붙일 쪽지, 원고 옆 참고 조각이어야 한다.
- 작품 카드는 "마지막 작업일"(날짜)보다 **"마지막 문장"·"다음 장면"** 을 먼저.

### 2-3. 정보 구조 통찰 (2026-06-06 브레인스토밍)

초기 목업(`a-reentry-memo-flow.html`)은 작품 보드·종이·메모를 **한 화면 3열**로 합쳐 대시보드처럼 읽혔다. 사용자가 "작업 벽은 작업실이 아니라 메인(작품 고르기) 화면 아니냐"고 정확히 지적 → **두 종류 화면으로 분리** 확정:

- **메인(작품 고르기) = 작업 벽** → rail "작품"
- **집필실(한 작품 쓰기) = 서랍형 종이** → rail "집필"

메모는 별도 rail "메모" 화면으로 유지하되 작업대로 재표현.

---

## 3. 현재 코드 상태 (실측)

### 3-1. 화면·컴포넌트 (변경 대상)

| rail | 화면 컴포넌트 | 현재 성격 | 재디자인 방향 |
|---|---|---|---|
| `projects` | `desktop/src/screens/ProjectsScreen.tsx` | 작품 목록(카드 그리드, 메타 카드) | **작업 벽형** — 핀보드 + 마지막 문장 얼굴 |
| `write` | `desktop/src/screens/WriteStudioScreen.tsx` | 집필 surface + chrome 다수(Dock/ZoomControl/PanelToggle/MemoPanel 동시) | **조용한 서랍형** — 종이 우선, control 접힘 |
| `memo` | `desktop/src/screens/MemoInboxScreen.tsx` | 필터(전체/미연결) + inline 입력 + 연결/삭제 + 우측 통계 패널 | **쪽지 책상형** — 통계·필터 제거, 흩어진 쪽지 |
| `log` | `desktop/src/screens/LogScreen.tsx` | placeholder | 현행 유지(§8 비범위) |

### 3-2. 관련 컴포넌트

| 컴포넌트 | 현재 | 본 doc 영향 |
|---|---|---|
| `desktop/src/components/Rail.tsx` | 작품/집필/메모/기록 + 하단 `빠른 메모`(`+` SVG, `aria-label="빠른 메모"`) | 하단 버튼을 **"잉크 한 방울"** affordance 로 (아이콘+의미). rail 항목 유지 |
| `desktop/src/components/QuickCapture.tsx` | 빠른 메모 모달. ESC 닫기 있음. 전역 단축키·focus restore·초안 보존은 미비(주석상 "전역 단축키는 후속") | §4-5 hardening 대상 |
| `desktop/src/components/MemoPanel.tsx` | 집필 화면 연결 메모 패널(Phase 6 실데이터 결선됨) | 서랍형의 "서랍" 안으로 재배치 |
| `desktop/src/components/{Dock,ZoomControl,PanelToggle,Titlebar,Toast}.tsx` | 집필 화면 control bar / 확대축소 / 패널토글 / 타이틀바 / 토스트 | 집필 control 을 **하나의 접힌 보기 메뉴**로 통합(P1) |
| `desktop/src/components/LinkPopover.tsx` | 메모-작품 연결 체크리스트 팝오버 | 쪽지 책상의 "붙이기" 진입점으로 재사용 |

### 3-3. 디자인 토큰 (실측 — `desktop/src/styles/app.css` `:root`)

OKLCH 기반, light/dark 양면. **본 재디자인은 신규 팔레트를 만들지 않고 기존 토큰을 따른다**(PRODUCT.md "identity-preservation").

| 역할 | 토큰 | light 값 | 목업 근사색(폐기) |
|---|---|---|---|
| 작업실 바닥(우드) | `--bg` | `oklch(0.705 0.044 64)` | `#a98d73` |
| 레일/패널 | `--surface` | `oklch(0.930 0.009 78)` | `#eee9df` |
| 종이 | `--paper` | `oklch(0.985 0.008 85)` | `#fffdf7` |
| 잉크(본문) | `--ink` / `--ink-soft` | `0.280` / `0.400` | `#2c241d` |
| 보조/흐림 | `--muted` / `--faint` | `0.520` / `0.640` | — |
| accent(잉크블루) | `--accent` | `oklch(0.470 0.125 252)` | `#1f5f9f` |
| 세리프 | `--font-serif` | **`"Gowun Batang", "Apple SD Gothic Neo", serif`** | (목업은 Georgia — **폐기**) |
| 산세리프 | `--font-sans` | `"Noto Sans KR", "Apple SD Gothic Neo", system-ui` | — |

> ⚠️ 목업은 Georgia·HEX 로 빠르게 그렸다. **구현은 위 OKLCH 토큰 + Gowun Batang 을 SoT 로** 한다. 목업의 색/폰트 값을 그대로 옮기지 않는다.

### 3-4. 환경 주의 (회귀 방지)

- `node:sqlite` 는 Node 24 필요. 검증 시 `PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` 선행 후 `pnpm test/typecheck/build`.
- frontend 변경 직후 `pnpm build`(RSC 아님, Vite/Electron renderer지만 빌드 게이트) + Electron 창 dogfooding 의무.

---

## 4. 확정된 설계 결정 (브레인스토밍 2026-06-06)

### 4-1. 메인 = 작업 벽형 (`ProjectsScreen`)

- 작품들이 **핀보드에 꽂힌 원고**처럼 한눈에(`repeat(auto-fit, minmax(~220px,1fr))`, 살짝 회전 + 핀 점).
- **카드의 얼굴 = 마지막 문장**(세리프). 그 아래 작게 "다음 장면 · ___". **날짜·진행률·카운터 지표 제거**(재진입 단서가 아님).
- 카드 클릭 → 해당 작품 집필실(`write`)로 진입(`activeProject` 설정).
- 새 작품 = 빈 핀 카드("+ 새 이야기 걸기").
- 비범위: 작품 메타(톤/장르/목표분량) 편집 진입은 유지하되 첫 화면에서 숨김(카드 안 보조 정보 X).

### 4-2. 집필실 = 조용한 서랍형 (`WriteStudioScreen`)

- **평소엔 종이만**. 종이가 화면의 주인공(중앙, 넓은 여백, `--paper` + `--shadow-paper`).
- 집필 control(zoom/줄노트/테마/자동저장 = 현 `Dock`/`ZoomControl`/`PanelToggle`)을 **하나의 접힌 "보기" 메뉴**로 통합(P1). 저장 상태·글자수만 titlebar 에 상시.
- 연결 메모(`MemoPanel`)는 우측 가장자리 **서랍 탭**으로 닫힘. 필요 시 열림.
- **재진입 순간 단 한 장**: 작품에 들어온 직후, "여기서 멈췄어요 — 다음은 ___. ___ 쪽지를 곁에 둘까요?" 한 장이 종이 옆에 펼쳐진 상태로 시작(나머지는 서랍에 닫힘). 이 한 장이 재진입 안도감의 구체적 구현(P1).

### 4-3. 메모 = 쪽지 책상형 (`MemoInboxScreen`)

- **흩어진 쪽지**(masonry/columns, 약간 회전) — 작업 벽과 같은 아날로그 DNA.
- 쪽지 본문을 **세리프로 크게** → "이 쪽지를 어느 작품에 붙일까"가 화면 중심.
- 작품에 붙은 쪽지엔 **작품 이름표**(✎ 작품명), 안 붙은 쪽지엔 **`＋ 작품에 붙이기`** 만(`LinkPopover` 재사용).
- **제거**: 우측 "메모 현황" 통계 패널(전체/미연결 카운트), `전체/미연결` 세그먼트 필터, "미연결" 관리 언어.
- **대체**: 상단에 부드러운 "추림" 칩(전부 / 작품명 / 아직 안 붙인 것) — 필터가 아니라 책상 위 추리기.
- inline 입력은 유지하되 "쪽지 한 장 적기" 톤으로.

### 4-4. 빠른 메모 = 잉크 한 방울 (`Rail` + `QuickCapture`)

- rail 하단 `+` → **"잉크 한 방울"** — 잉크 방울 형태 아이콘 + (호버/포커스 시) 라벨. "새 항목"이 아니라 캡처임이 드러나야 함(P2).
- 세 화면 모두에서 동일 affordance.

### 4-5. 빠른 메모 모달 hardening (`QuickCapture`)

critique P2 + QA 후속:

- **초안 유실 방지**: 입력 중 닫기 시도 시 즉시 폐기하지 않음(내용 있으면 보존 또는 확인).
- **focus trap + restore**: 모달 안에서 Tab 순환, 닫으면 직전 포커스(집필 커서 등)로 복귀.
- **현재 작품 자동 연결**: 집필 중이면 현재 작품에 바로 연결(이미 동작 — 유지·표기).
- **명시적 focus-visible**: 전역 `outline:none` 우회(§7).
- (열린 결정) 전역 캡처 단축키: 핸드오프/주석상 "후속 phase". 본 doc 범위에 넣을지 §10.

---

## 5. 디자인 토큰 / 신규 토큰 결정

기존 토큰으로 대부분 커버. **신규로 필요한 것 = 쪽지(scrap) 면**:

- 메모 쪽지 배경: 목업은 크림옐로(`#fbf3df`). 기존 `--paper`(거의 흰 웜)와 구분되는 "포스트잇/쪽지" 면이 필요.
- 결정: `--scrap`(쪽지 면) + `--scrap-edge`(테두리)를 **DESIGN.md 토큰에 신규 추가**. OKLCH 로 light/dark 양면 정의(light ≈ `oklch(0.93 0.04 92)` 계열, dark 는 채도 낮춘 변형). 정확값은 구현 시 대비 검증 후 확정.
- 핀(작업 벽), 서랍 탭, 잉크 방울은 기존 `--accent`/`--surface`/`--hairline` 조합으로 충분(신규 토큰 불요).

---

## 6. 모션

- 서랍 열기/닫기, 재진입 쪽지 펼침: 150–250ms, `--ease-out`. 상태 전달용(장식 X, product register).
- 쪽지 붙이기 성공: 즉시 반영(이미 optimistic — `893f0e7`). 칩/이름표 동기화.
- `prefers-reduced-motion: reduce` 대체 의무(크로스페이드/즉시) — PRODUCT.md 접근성.

---

## 7. 접근성 — critique 기술 지적 반영

| 항목 | 현재 | 조치 |
|---|---|---|
| `--faint` on `--surface-sunken` | light ≈ 2.33:1 (placeholder 4.5:1 미달) | placeholder/보조 텍스트는 `--muted` 이상으로, 또는 `--faint` 자체를 ink 쪽으로 상향 |
| `--muted` on `--surface` | light ≈ 4.27:1 (13–15px 위험) | 본문급 보조 텍스트는 `--ink-soft`, 14px↑ 유지 |
| 전역 `:focus-visible { outline: none }` | focus ring 소실 | `QuickCapture`/`LinkPopover`/삭제 dialog/`Toast` action 에 명시적 `box-shadow` focus ring 부여 |
| 나무결 grain `--grain-opacity:.16` (P3) | texture slop 위험 | 쪽지 책상·작업 벽처럼 면이 많은 화면에서 grain 영향 확인, 필요 시 화면별 하향 |
| 한국어 IME | — | TipTap 본문 입력 회귀 4케이스 재검(PoC 0-1) |

---

## 8. 범위 / 비범위

**범위(본 재디자인):** ProjectsScreen(작업 벽) · WriteStudioScreen(서랍형) · MemoInboxScreen(쪽지 책상) · Rail/QuickCapture(잉크 한 방울 + 모달 hardening) · 토큰 `--scrap` 신설 · §7 접근성 조정.

**비범위(후속):**
- `LogScreen`(기록) — placeholder 현행 유지. rail 노출은 그대로 두되 "미완성감"은 후속 polish. (critique minor)
- 나무결 texture 전면 재작업(P3) — 별도 polish.
- 전역 캡처 단축키 — §10 결정 따름.
- 데이터 모델/IPC/스키마 변경 — 없음(표현만).

---

## 9. 검증 (성공 기준)

1. 자동화: `pnpm test` / `pnpm typecheck` / `pnpm build` GREEN(Node 24).
2. 대비: 변경 화면의 본문·보조·placeholder 텍스트 WCAG AA(본문 ≥4.5:1, 큰 텍스트 ≥3:1) 실측.
3. dogfooding(Electron 창): (a) 작품 벽에서 마지막 문장이 카드 얼굴로 읽히는가 (b) 집필 진입 시 종이 우선 + 재진입 쪽지 한 장 (c) 메모 화면에 통계·필터가 없고 "붙이기"가 중심인가 (d) 잉크 한 방울이 "캡처"로 읽히는가 + 모달 focus restore.
4. 한국어 IME 회귀(집필 본문) 4케이스.
5. critique 재실행 시 P1 2건 해소 + 총점 상향.

---

## 10. 열린 결정 (구현 진입 전 확정 필요)

1. **전역 캡처 단축키**(예: ⌘⇧N): 본 재디자인 범위 포함 vs 후속. — critique P2/persona(키보드 작가)는 포함을 시사하나 핸드오프는 "후속 phase".
2. **`--scrap` 정확 OKLCH 값**: 구현 시 대비 검증 후 확정(본 doc 은 계열만).
3. **집필 control 통합 형태**: "보기" 드롭다운 vs 가장자리 접힘 패널 — 구현 shape 단계에서 1안 결정.
4. **재진입 쪽지 선정 로직**: "다음 장면" + "가장 최근 곁 쪽지" 자동 선택 규칙. (현재 데이터로 가능 범위 확인 필요)

---

## 부록 — 목업 참조

- 흐름(작품 벽 → 서랍형 집필실): `.superpowers/brainstorm/48729-1780686049/workshop-flow.html`
- 메모(쪽지 책상): `.superpowers/brainstorm/48729-1780686049/memo-desk.html`
- 물성 3안 비교(원고 책상/작업 벽/조용한 서랍): `.superpowers/brainstorm/48729-1780686049/workshop-materiality.html`

> 목업은 방향 확정용 스케치다. 색·폰트·치수는 §3-3 토큰을 SoT 로 재매핑한다.
