# 새 세션 핸드오프 — Desktop 집필 "진짜 페이지 분할" (필수 작업)

> **용도:** 본 문서는 Desktop write-note 집필 화면의 **진짜 페이지 분할(A4 장 단위로 본문이 실제 나뉘고 장 사이 여백)** 을 새 세션에서 이어 구현하기 위한 핸드오프다. 사용자가 "페이지 분할은 반드시 필요한 작업"으로 확정했다. 아래 §kickoff 프롬프트를 새 세션 첫 입력으로 붙여넣으면 된다.
>
> **작성일:** 2026-06-07
> **기준 브랜치:** `develop` (HEAD `968b0e0` — 줄노트 개선까지 반영, working tree clean)

---

## 1. 지금 어디까지 (현재 상태)

### 동작하는 것 (커밋됨, 건드리지 말 것)
- **Phase 8 MVP review gate ✅ 완료** (SC 8/8, "사용 가능한 prototype" 판정). 커밋 `0a4cc04`·`8f96e06`·`9579f78`.
- **줄노트 집필 개선 ✅ 완료** (커밋 `968b0e0`, develop). 사용자 만족:
  - 줄노트 default ON (`WriteStudioScreen` `lined` 초기값 `true`)
  - 줄선이 빈 종이에도 페이지 끝까지 미리 그려짐 (`.paper` flex column + `.prose`/`.ProseMirror` flex로 본문이 종이 높이를 채움)
  - 문단 간격 0 (`.paper--lined .prose .ProseMirror p { margin: 0 }`) → Enter = 바로 다음 줄(빈 줄 안 생김)
  - 종이 하단 여백 중앙에 페이지 번호 (`.page-num`, A4 297mm 기준 `ResizeObserver` 측정, 반올림 허용오차로 첫 장 1쪽)
- 환경: Node 24.14.0(`node:sqlite`), 검증 `cd desktop` + `node_modules/.bin/{vitest,tsc,vite}` 포어그라운드. 현재 vitest **160 GREEN**.

### 폐기된 것 (반복 금지)
- **010 원고지 모드(라이브 칸 편집)** — 폐기. SDD 산출물(spec/plan/tasks/design brief)은 `010-manuscript-mode` 브랜치 + `docs/superpowers/specs/2026-06-06-desktop-manuscript-mode-design.ko.md`에 기록으로 보존(develop 미merge). 폐기 사유는 아래 §3.

---

## 2. 목표 (이번 작업)

집필 화면 본문이 **A4 한 장을 채우면 실제로 다음 장(별도 종이)으로 넘어가는** 효과. "한 장의 종이가 아래로 길어지는" 현재 방식이 아니라, **장 사이에 책상색 여백이 있고 글이 다음 장 맨 위로 이어지는** 진짜 페이지 분할. (사용자 필수 요구.)

---

## 3. 이번 세션에서 시도했고 실패한 것 (같은 함정 반복 금지)

두 번의 "페이지처럼 보이게" 시도가 **둘 다 같은 종류로 RED** 였다. 핵심 교훈: **TipTap(단일 contenteditable) 위에서 실시간 레이아웃을 매 입력마다 다시 계산하면 한국어 IME가 깨지고 버벅인다.**

### (a) 원고지 라이브 칸 편집 — RED (폐기)
- 방식: `text-transform: full-width`로 모든 글자를 전각 1칸에 강제.
- 결과: **한글 음절이 자모로 분해됨**(ㅇㄹㅁ… 한 칸씩). text-transform이 한글 조합을 깨뜨림.
- 교훈: ASCII용 CSS를 한글 IME 본문에 쓰면 조합이 깨진다.

### (b) 실시간 페이지 분할 (ProseMirror 데코레이션) — RED
- 방식: TipTap extension(`paginationPoc.ts`, 현재 삭제됨)이 매 트랜잭션마다 모든 블록의 `offsetHeight`를 재측정 → A4 경계 넘는 블록 앞에 "장 사이 여백" 위젯 데코레이션 삽입 → 블록을 다음 장으로 밀어냄. `view.composing` 중 재계산 skip + 시그니처 비교로 루프 차단.
- 결과: **버벅임 + 깨짐**. 장 사이 띄움(책상색 band)은 보였으나, 매 타자마다 전체 블록 재측정(레이아웃 thrash) + 트랜잭션 dispatch → 입력이 버벅이고 글이 깨짐. 이것이 과거 `tiptap-pagination-plus` 제거 사유와 동일한 불안정성.
- 교훈: **매 키 입력마다 전체 재측정·재계산·재dispatch는 불가**. 이 구조로는 안 된다.

---

## 4. 가드레일 (반드시 준수)

- **한국어 IME 4케이스**(빠른 타자·조합 중 mark·한자·Backspace 자모)가 깨지면 즉시 RED. 이 프로젝트의 반복 함정(PoC 0-1, Phase 4, 원고지·페이지네이션 둘 다). `editor.view.composing` guard 유지.
- **저장 포맷 불변** — 본문은 ProseMirror JSON(`documents.bodyJson`). 페이지 분할은 표현/데코레이션만, 문서·DB 스키마 변경 0.
- **줄노트 개선(968b0e0) 보존** — 회귀 금지.
- **PoC 게이트 + 조기 dogfooding** — 풀 구현 전에 작은 PoC로 IME·성능을 **사용자 실키보드로 일찍** 검증. RED면 즉시 멈추고 재논의. (이번 세션이 두 번 늦게 표면화돼 "개쓰레기"를 두 번 보임 — 다음엔 더 작게·더 일찍 dogfood.)
- 검증: `cd desktop`, Node24 PATH 선행, `node_modules/.bin/{vitest,tsc,vite}` 포어그라운드. 변경 화면 대비 SC-006 재측정.

---

## 5. 다음 세션 추천 접근 (블라인드 구현 금지 — 먼저 조사 + 작은 PoC)

이번 실패의 근본 원인은 **"실시간·매입력·전체재계산"**. 이걸 피하는 방향을 우선 조사·검증하라. 추측으로 바로 구현하지 말 것(추측 금지 HARD-GATE).

1. **먼저 조사(context7/WebSearch):**
   - contenteditable 기반 에디터가 페이지네이션을 어떻게 하나 — Google Docs/Word는 contenteditable flow가 아니라 **커스텀 레이아웃 엔진**을 쓴다(즉 진짜 WYSIWYG 페이지네이션은 본질적으로 어렵다는 점 인지).
   - TipTap **공식/유지보수되는 pagination extension** 현황(있나? 안정적인가?), `paged.js`(인쇄 지향), ProseMirror pagination 사례.
   - 결론을 `docs/poc/` 또는 research 노트에 박고 옵션 비교(검증된 정보로만).

2. **"실시간 전체 재계산"을 피하는 설계 후보(조사 후 택1+PoC):**
   - **idle 디바운스**: 타이핑 중엔 페이지 계산 안 함. 입력이 멈춘 뒤(예: 400ms, `requestIdleCallback`) 1회만 재계산. 입력 자체는 절대 막지 않음.
   - **증분 계산**: 변경된 블록 **아래쪽만** 재측정(dirty range 추적). 전체 O(n) 재측정 회피.
   - **줄 수 기반 계산**: 줄노트는 line-height 1.92em 고정 → 한 쪽당 줄 수 = floor(USABLE/lineHeight)로 픽셀 측정 없이 근사 가능한지 검토(블록 wrap 줄 수 계산이 관건).
   - **비실시간/모드 분리(현실적 fallback)**: 편집은 연속, **"페이지 보기/미리보기"** 모드에서만 페이지로 렌더(타이핑 비용 0 → 안정적). 사용자는 "진짜 분할"을 원하므로 1순위는 아니지만, 실시간이 끝내 불안정하면 이 방향으로 협의.

3. **PoC 순서:** 가장 유망한 1안으로 **작은 PoC** → 사용자 실키보드 dogfooding(IME 4케이스 + 긴 글 타이핑 버벅임 + 커서) → GREEN이면 정식, RED면 다음 후보.

4. **브랜치/스펙:** 페이지 분할은 010 원고지와 별개 신규 feature. speckit 풀파이프(`/speckit-specify`…)로 새 번호(011 예상) 진행하거나, 위험이 커 PoC 선행이 핵심이므로 **PoC 먼저 → spec**도 가능. 사용자와 빌드 구조 확정.

---

## 6. 시작 순서 (제안)

1. 본 문서 + `968b0e0` 변경(Editor.tsx/WriteStudioScreen.tsx/app.css) 정독 → 현재 줄노트 구조 파악.
2. §5-1 조사(context7/web) → 옵션 비교를 검증된 정보로 구성 → 사용자에게 빌드 구조(실시간 1안 vs 모드 분리) 확정받기.
3. 가장 유망한 안으로 작은 PoC → **조기 dogfooding**.
4. GREEN → 정식 구현(IME·성능·줄노트 회귀·대비 게이트). RED → 다음 후보 또는 모드 분리 협의.

---

## 7. kickoff 프롬프트 (새 세션 첫 입력으로 복사)

```
Desktop write-note 집필 화면의 "진짜 페이지 분할"(A4 장 단위로 본문이 실제 나뉘고 장 사이 책상색 여백)을 구현한다. 사용자 필수 요구다. CLAUDE.md와 .claude/rules의 HARD-GATE를 모두 따른다(추측 금지/단정 금지, 한국어, TDD, 빌드·테스트 포어그라운드, 외부 vault SoT, 한국어 IME 회귀 cadence).

[0] 먼저 읽기:
- docs/handoff/2026-06-07-pagination-handoff.md  (본 작업 진입점 — 목표·실패 이력·가드레일·추천 접근)
- vault ~/obsidian/write-note/02-PROGRESS.md + 03-ISSUES.md  (진척·이슈, 답변 전 Read 의무)
- 현재 줄노트 구조: desktop/src/components/Editor.tsx · screens/WriteStudioScreen.tsx · styles/app.css (커밋 968b0e0)

[1] 기준선 재확인(재구현 금지): cd desktop && export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" && node -v(v24) → node_modules/.bin/vitest run(160 GREEN 기대) + tsc --noEmit + vite build.

[2] 핵심: 이번 세션(2026-06-06~07)에 페이지 분할을 두 방식으로 시도해 둘 다 RED였다(핸드오프 §3) — (a)원고지 text-transform이 한글 자모 분해, (b)실시간 ProseMirror 데코 페이지네이션이 매 입력 전체 재계산으로 버벅임·깨짐. 같은 함정 반복 금지. "실시간·매입력·전체재계산"을 피하는 설계가 본질(§5).

[3] 블라인드 구현 금지: 먼저 context7/WebSearch로 contenteditable 페이지네이션 사례(TipTap 공식/유지 extension, paged.js, ProseMirror, Google Docs가 contenteditable을 안 쓰는 이유)를 조사해 검증된 옵션 비교를 만들고, 빌드 구조(실시간 디바운스/증분 1안 vs '페이지 보기' 모드 분리 fallback)를 사용자에게 확정받아라. 그 다음 작은 PoC → 사용자 실키보드 dogfooding(IME 4케이스 + 긴 글 버벅임 + 커서)으로 조기 검증. RED면 멈추고 재논의.

[가드레일] 한국어 IME 깨지면 즉시 RED / 저장 포맷(ProseMirror JSON)·DB 스키마 불변 / 줄노트 개선(968b0e0) 회귀 금지 / PoC 먼저 + 조기 dogfooding / Node24 포어그라운드 게이트 / 변경 화면 SC-006 대비 재측정.

먼저 [0] 읽고 [1] 기준선 보고 + [3] 조사 착수 전 빌드 구조 확정 질문부터 하라.
```

---

## 부록 — 참조

- 줄노트 개선 커밋: `968b0e0`
- 폐기된 원고지 SDD: `010-manuscript-mode` 브랜치 + `docs/superpowers/specs/2026-06-06-desktop-manuscript-mode-design.ko.md`
- Phase 8 판정: `docs/phase/08-mvp-review/2026-06-06-review.md`
- 한국어 IME 회귀 SoT: `docs/poc/0-1-tiptap-korean.md` + `.claude/rules/typescript/code-quality.md`
