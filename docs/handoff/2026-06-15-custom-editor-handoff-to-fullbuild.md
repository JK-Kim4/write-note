# 자체 에디터 엔진 — PoC 결과 & 본 구축 인수인계

- 일자: 2026-06-15
- 브랜치: `024-custom-editor` (base `develop`) · 워크트리: `../write-note-024-custom-editor` (repo 바깥, 격리)
- 상태: **PoC 완료 — 4기준 전부 검증.** 다음 = 본 구축(설계→구현)
- 독자: 컨텍스트 0인 새 세션. 이 문서 하나로 진입 가능하게 작성.

---

## 0. TL;DR

집필 에디터를 **TipTap(CSS `column-wrap` 페이지분할) → 자체 EditContext 엔진**으로 교체하는 작업. 동기는 column-wrap 이 비표준·취약해 줄단위 분할·규격 리플로우·**가변높이 이미지**를 구조적으로 못 했기 때문.

**PoC 가 4가지 핵심을 전부 증명**했다 — ① 문단 줄단위 분할 ② 규격·폰트 리플로우 ③ 가변높이 이미지 ④ 한글 IME 조합. + 기본 선택까지. **자체 엔진 방향이 실측으로 입증됨.** 이제 **go 결정 후 본 구축**(서식·저장·집필실 통합·선택 마무리·성능·Safari)으로 넘어가는 단계.

**바로 보기:** `cd frontend && pnpm dev` → Chrome 으로 `http://localhost:3000/poc/editor`. (EditContext 는 Chrome/Edge 전용)
**엔진 테스트:** `pnpm exec vitest run src/components/poc-editor` (7 GREEN)

---

## 1. 배경 — 왜 자체 엔진인가

현행 집필 에디터(A형 `PaperEditor`·B형 `BEditor`)의 페이지 분할은 **두 개의 분리된 시스템**으로 돼 있다:
- **텍스트:** 단일 `.ProseMirror`(TipTap)를 CSS `column-wrap`/`column-height`(비표준·Chrome 전용)로 흘려 분할.
- **종이 그림:** JS 가 측정 높이 ÷ stride 로 **장수만 추정**해 흰 시트를 절대배치.

이 둘은 단일 진실원 없이 "좌표가 우연히 맞도록" 조율돼 있어, 35px 격자를 벗어나는 순간(제목 margin·인용·**이미지**) 어긋난다. 실사용 증상: 여백에 입력·문단 통째 점프·규격변경 깨짐·이미지 첨부 불가. 수정 이력(`b.css` 6커밋 등)이 두더지잡기 → **버그가 아니라 아키텍처 한계.** (근본원인 분석: `docs/handoff/2026-06-15-pagination-orphans-widows-fix.md` 및 본 repo 분석 기록 참조.)

> 핵심: **JS 가 분할을 *하지 않는다*. CSS 가 하고 JS 는 추정만 한다.** 제어를 뒤집어 **JS 가 측정→배치→렌더**하면 셋 다 한 메커니즘으로 풀린다.

---

## 2. 결정 (ADR 요지) — 상태: Accepted

### 고려한 대안
- **A. EditContext + 자체 측정-배치 레이아웃 엔진 + DOM 렌더** ← **채택.** 입력은 EditContext(한글 IME 실증), 분할은 JS 가 직접 결정, 결과를 DOM 렌더. 비표준 column-wrap 폐기. 단점: 커서·선택 등 입력 부속을 직접 구현(과거 폐기 영역) → **순서를 뒤집어 분할을 먼저** 증명하며 회피.
- **B. TipTap 입력 유지 + 분할만 자체 JS.** 입력 재구현 0 이지만, ProseMirror 단일연속문서를 페이지로 쪼개면 커서가 경계서 깨짐(=현 버그 클래스 잔존). 기각.
- **C. Canvas 렌더(Docs/Word식).** 완전통제지만 글자렌더·선택·접근성·복붙까지 전부 바닥부터. 과함. 기각.

### 결정
**A 안을 채택하고, 우선 Chromium 전용으로 간다.** (EditContext = Chrome/Edge 121+ 안정, Firefox/Safari 미지원 — 2026-06 확인. portable 백엔드는 본 구축 후반.)

### 결과
- **긍정:** 줄단위 분할·규격/폰트 리플로우·가변높이 이미지가 한 모델로 풀림. 정수 줄높이 제약 소멸(폰트 크기 자유). 비표준 의존 제거.
- **부정:** 입력 부속(선택·복붙·undo·affinity)을 전부 직접 구현해야 함. 접근성(스크린리더)·Safari 는 별도 과제. 매 입력 전체 재측정(성능 — 증분화 필요).
- **중립:** 저장 포맷 재설계 필요(기존 ProseMirror JSON 과의 관계 결정 대기).

---

## 3. PoC 가 증명한 것 (검증된 사실 + 증거)

| # | 기준 | 결과 | 검증 방법(증거) |
|---|---|---|---|
| ① | 문단이 페이지 경계서 **줄 단위로 이어짐**(통째 점프 X) | ✅ | 헤드리스 스크린샷(page1 꽉 참 → page2 같은 문단 이어받음) |
| ② | 용지(A5/A4/B4/A3)·폰트(14~28px) 변경 시 **즉시 재배치** | ✅ | 레이아웃 엔진 단위테스트 + 셀렉터 동작 |
| ③ | **가변높이 이미지** 끼워도 분할 정확(안 들어가면 통째 push) | ✅ | 스크린샷(이미지 page2로 밀림 + 빈공간) |
| ④ | **한글 IME 조합**(빠른 타자·겹받침에 자모 안 깨짐) | ✅ | **사용자 dogfooding 통과(2026-06-15)** — 헤드리스 불가 영역 |
| + | 기본 선택(드래그·Shift/Cmd/Option+화살표·Cmd+A·교체삭제·하이라이트·네이티브 억제) | ✅ | CDP 인터랙티브 구동(아래 모두 통과) |

**CDP 로 실측한 인터랙션:** 클릭(520,250)→캐럿(518,234) 정확 / 캐럿 vs 브라우저 `caretRangeFromPoint` **diff 0px**(4지점) / 선택 위 타이핑=교체 / 선택+Backspace=삭제 / Cmd+A→Backspace 전체삭제 / Cmd+←=줄맨앞(caretX 652→348) / 네이티브 선택 0.

> 상세 검증 수치·스크린샷·버그 추적은 **`docs/poc/2026-06-15-custom-editor-build-log.md`** 가 SoT.

---

## 4. 현재 코드 — 무엇이 어디에 (총 ~1040줄)

워크트리 `frontend/` 기준. **전부 신규 파일**(기존 코드 무수정 — 현행 집필실과 격리).

| 파일 | 줄 | 역할 |
|---|---|---|
| `src/components/poc-editor/geometry.ts` | 62 | 용지·폰트 → 페이지 기하(px). **실제 A4 비율**(mm×96/25.4). 줄높이=fontSize×1.8(분수 허용) |
| `src/components/poc-editor/layoutEngine.ts` | 86 | **핵심.** 순수함수 `layout(measuredBlocks, contentHeightPx)→Page[]`. "남은 높이" 커서로 줄/이미지 배치·분할·push. 측정값 주입 → 브라우저 없이 결정론적 |
| `src/components/poc-editor/layoutEngine.test.ts` | 72 | 위 TDD 단위테스트 7개(①②③ 로직) |
| `src/components/poc-editor/measure.ts` | 100 | 브라우저 측정. `measureParagraphLines`(줄바꿈·문자범위, `Range.getClientRects`) + `measureLineXs`(줄 내 문자별 x — 캐럿·hit-test, **canvas 아님**) |
| `src/components/poc-editor/PocEditorLive.tsx` | 509 | 라이브 에디터. EditContext 입력루프 + 버퍼파싱·재측정·재분할·재렌더 + 자체 캐럿/선택/드래그/키보드 + 이미지. **메인 산출물** |
| `src/components/poc-editor/PocEditor.tsx` | 160 | 정적 렌더(입력 없음) — `/poc/editor-static` fallback |
| `src/components/poc-editor/editcontext.d.ts` | 39 | EditContext 최소 타입(lib.dom 미포함) |
| `src/app/poc/editor/page.tsx` | 6 | 라우트 → PocEditorLive |
| `src/app/poc/editor-static/page.tsx` | 6 | 라우트 → PocEditor(정적) |

**데이터 흐름(라이브):**
`EditContext.text 버퍼` → `textupdate(IME·타이핑·Backspace 자동)` → `relayout`(파싱→measure→layout) → DOM 렌더 + 자체 캐럿/선택 → (드래그·키보드가 selection 갱신 → EditContext 동기)

**문서 모델(PoC):** 평문 버퍼. 문단은 `\n` 구분, 이미지는 `U+FFFC` 한 글자. 선택은 `{anchor, focus}`.

**실행/검증:**
```bash
cd frontend
pnpm dev                                       # Chrome → localhost:3000/poc/editor
pnpm exec vitest run src/components/poc-editor  # 엔진 7 tests
pnpm exec tsc --noEmit && pnpm build            # 게이트
```

---

## 5. 핵심 기술 학습 (gotchas — 다시 밟지 말 것)

1. **EditContext 정규 루프:** `editContext.text` 가 버퍼(이미 갱신됨). `textupdate` 에서 읽어 재렌더, 캐럿=`e.selectionStart/End`. 타이핑·IME·**Backspace·화살표는 자동** textupdate. **Enter/Tab 만** 안 옴 → keydown 에서 `updateText`. 선택을 `updateSelection(min,max)` 로 동기하면 **타이핑/Backspace 가 선택을 교체/삭제**해줌.
2. **텍스트 위치 = 렌더와 같은 측정 방식:** 캐럿 x 를 `canvas measureText` 로 쟀더니 한글 폰트를 좁게 폴백 측정 → DOM 렌더와 어긋나 **누적 드리프트.** → 줄바꿈·캐럿·hit-test 전부 **오프스크린 DOM `Range`(`measureLineXs`)** 로 통일. (canvas↔DOM 혼용 금지.)
3. **자체 캐럿 그리면 호스트 `caret-color: transparent`** — 안 하면 브라우저 네이티브 캐럿이 같이 보여 **캐럿 2개.**
4. **wrap 경계 캐럿 affinity:** `caretToScreen` 줄찾기를 `within < line.end`(`<=` 아님)로 해야 경계 offset 이 다음 줄 시작에 렌더(Cmd+←·타이핑 줄바꿈 정합). **한계:** affinity 미추적이라 줄 끝 정확히 클릭 시 다음 줄 시작에 붙음 → 본 구축서 upstream/downstream 추적.
5. **SWC 빌드 함정:** SVG data URI 를 `` `...${x}...` `` 보간 템플릿으로 쓰면 SWC 상수폴딩이 `'/>` 를 유실해 SVG 깨짐. **리터럴 문자열**로.
6. **측정/레이아웃은 `useMemo`(클라이언트 마운트 후)** — SSR 시 document 없음. `mounted` 가드.

---

## 6. 본 구축 범위 (Goals / Non-goals)

### Goals (go 시 해야 할 것 — 대략 우선순위)
1. **서식 모델** — 평문 → rich text(구간 속성: 부분 폰트크기/볼드/기울임/제목 등). PoC 의 평문 버퍼를 "속성 가진 모델"로 확장. *("드래그 부분만 폰트"가 여기.)* 측정·레이아웃이 줄 내 혼합 폰트(가변 높이 줄)를 다루도록 일반화 필요.
2. **저장 결선** — 기존 챕터는 `documents.bodyJson`(ProseMirror JSON). 신규 포맷 정의 + **마이그레이션**(또는 호환 레이어). 자동저장(016 `useDocumentSession`)·버전 토큰 연동.
3. **집필실 통합** — A형(`PaperEditor`/`ChapterEditor`)·B형(`BEditor`/`BChapterEditor`) 8개 파일에서 TipTap 걷어내고 자체 엔진으로 교체. 아웃라인(heading 파생)·곁쪽지·인물 패널 등 주변 기능 재결선.
4. **선택 마무리** — caret affinity 추적, 복붙(clipboard), undo/redo.
5. **성능** — 현재 매 입력마다 전체 문단 재측정 → **편집 지점만 증분 재측정.** 대용량 원고 가상화.
6. **Safari/Firefox** — portable 입력 백엔드(EditContext 대체: contenteditable 또는 hidden-textarea). 입력층 인터페이스화.
7. **접근성** — 스크린리더/AOM 노출(자체 렌더라 직접 책임).

### Non-goals (PoC 의도적 제외 — 본 구축서 포함 여부는 결정 대상)
- 위 Goals 외 신규 기능(협업 등)은 본 작업 범위 밖.
- portable 백엔드는 Chromium 검증·통합 완료 후로 미뤄도 됨(현 제품 타깃에 따라).

---

## 7. 권장 진행 방식 — 새 세션은 여기서 시작

1. **ad-hoc 금지.** 규모가 큰(여러 라운드) 작업이라 즉흥 구현하면 목표 상실 위험(`.claude/rules/shared/agent-workflow-discipline.md §10` — "양보 불가 핵심을 첫 dogfoodable 산출물에서"). **brainstorming → spec → plan → 구현** 으로.
2. **첫 라운드 후보(권장 순서):** 서식 모델 + 측정/레이아웃 일반화(혼합 폰트) → 저장 결선 → 집필실 한 형(예: B형) 통합 dogfooding → 나머지. 각 라운드가 **dogfoodable** 하게.
3. **PoC 코드는 재사용 토대.** `geometry`/`layoutEngine`/`measure` 는 거의 그대로, `PocEditorLive` 의 입력·캐럿·선택 로직을 정식 컴포넌트로 승격하며 서식 모델에 맞게 확장.
4. **검증 습관 유지:** 인터랙션은 헤드리스 CDP(`Input.dispatchMouseEvent`/`insertText` + `caretRangeFromPoint` 비교)로 자동 검증 가능. IME 조합만 사용자 dogfooding.

### 제약 / 주의
- **023-export 미커밋 패치는 그대로 둔다(건드리지 말 것).** 현행 column-wrap 의 임시 개선(orphans/widows·정수줄높이·백지기본)으로, 별도 세션 소유. 격리됨.
- **미래 머지충돌 주의:** 본 구축이 `BEditor.tsx`·`paper-editor.css`·`pageLayout.ts` 를 교체하는데 023 미커밋도 그 파일들 → 둘 다 develop 갈 때 충돌. 통합 시점에 정리.

---

## 8. 열린 질문 (본 구축 전 결정 필요)

- **저장 포맷:** 기존 ProseMirror JSON 호환 유지 vs 신규 포맷 + 마이그레이션? (공동집필 version 충돌 감지 제거 금지 — `[[collaborative-writing-planned]]`)
- **서식 모델 형태:** 구간(span) 속성을 어떤 자료구조로? (flat run-list vs tree)
- **집필실 통합 전략:** A/B 동시 교체 vs 한 형 먼저 dogfooding 후 확산?
- **Safari 지원 시점:** 본 구축 포함 vs 이후? (제품 타깃 브라우저 정책)
- **줄 affinity·undo** 설계 방식.

---

## 9. 참조

- **설계:** `docs/poc/2026-06-15-custom-editor-engine-design.md`
- **빌드로그(검증·버그 SoT):** `docs/poc/2026-06-15-custom-editor-build-log.md`
- **근본원인:** `docs/handoff/2026-06-15-pagination-orphans-widows-fix.md`(현행 column-wrap 분석)
- **커밋(7):** `5f232db`(엔진+기하+측정+정적) → `e48ba35`(M5 EditContext) → `c9cd5d0`(M6 캐럿클릭·화살표) → `ad7acab`(캐럿드리프트 fix) → `373703c`(캐럿2개 fix) → `0201ca7`(선택) → `23a5fb4`(IME 통과)
- **메모리:** `[[custom-editor-024]]`, `[[desktop-pagination-mandatory]]`
- **회귀 룰 후보(미반영):** "텍스트 위치 계산 = 렌더와 같은 측정 방식(canvas↔DOM 혼용 금지)" / "자체 캐럿 시 host caret-color:transparent" — 회고 시 `agent-workflow-discipline.md` 갱신 검토.
