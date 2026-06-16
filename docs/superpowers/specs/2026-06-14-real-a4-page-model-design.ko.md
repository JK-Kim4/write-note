# 진짜 A4 페이지 모델 + 줄노트 정렬 재설계 — 설계

**일자:** 2026-06-14
**상태:** 설계 확정 (사용자 승인 2026-06-14 → writing-plans 진입)
**브랜치:** `023-export` 이어가기 (export 의 선행 작업)
**선행/후속 관계:** 본 재설계 완료 → 023 Export **Phase 3 PDF 본구현 재개**(보류 중) → DOCX → HWPX

---

## 1. 배경 · 목표

집필 화면의 페이지는 현재 **진짜 A4(297mm)가 아니라 양식화된 줄수 모델**이다 — 가로는 진짜 A4(210mm)지만 세로는 줄높이(34.56px) 정수배를 맞추려고 26줄(≈256mm)로 양식화돼 있다(`pageLayout.ts` 주석: "sheet = 28줄 ≈ 256mm ≠ 297mm"). 양식화 이유는 **줄노트(가로 괘선)가 페이지마다 정렬되려면 페이지 높이가 줄높이 정수배여야** 하기 때문이다(`paper-editor.css` 주석).

이 양식화 때문에 PDF export 가 막혔다 — 화면을 그대로 인쇄하는 방법 A(화면 `column-wrap` + `@media print`)는 **실측 실패**(2026-06-14): `column-wrap`(CSS Multicol L2, Chrome 145+)이 인쇄 엔진에서 페이지 분할로 변환되지 않아 경계가 어긋나고 빈 페이지가 생겼다.

**리서치 결론(2026-06-14, WebSearch):** 줄 정렬의 표준 원리는 **"baseline grid 는 페이지마다 재시작"**이다([A List Apart](https://alistapart.com/article/settingtypeontheweb/), [W3C CSS Line Grid L1](https://www.w3.org/TR/css-line-grid-1/)). line box 는 페이지 경계에서 쪼개지지 않으므로, **페이지 전체가 아니라 "본문 영역만 줄높이 정수배"로 만들고 진짜 A4 의 잔여 높이는 하단 여백이 흡수**하면, 진짜 A4(297mm)와 줄노트 정렬이 양립한다.

**목표:** 집필 화면 페이지를 **진짜 용지 치수**로 통일하면서 줄노트를 페이지마다 정렬하고, 그 위에서 PDF export(화면=PDF)를 가능하게 한다.

### 사용자 결정 (2026-06-14)
| 결정 | 내용 |
|---|---|
| 방향 | 줄노트 재설계(진짜 A4 모델) **선행** → 그 위에 PDF export |
| A형 집필실 | **A4 고정 유지**(진짜 A4 로만 전환, 용지 4종 동적은 도입 안 함) |
| 화면 세로 | 진짜 A4 로 **+16%(256→297mm) 길어짐 감수** |
| 용지별 N줄 | A4 27 · B4 34 · A3 40 · A2 59 (아래 §3) |

---

## 2. 핵심 모델

- **페이지(sheet) = 진짜 용지 높이**(A4 297mm 등). 가로는 이미 진짜(210mm).
- **본문 영역(`column-height`) = N줄 × LINE_PX**(줄높이 정수배) → 줄노트 정렬 보장.
- **잔여(용지높이 − 상단여백 − 본문영역) = 하단 여백이 흡수.**
- **줄노트**(`repeating-linear-gradient`)는 본문 영역(정수배)에만 그려져 페이지마다 정렬.
- 결과: 각 페이지가 줄 상단에서 시작(baseline grid 페이지 재시작) → **페이지 경계 괘선 어긋남 0 + 진짜 용지 치수** 양립.
- **분할 메커니즘은 불변** — 현행 `column-width`/`column-height`/`column-wrap`(CSS Multicol L2) 그대로. 기하 상수(높이·줄수)만 진짜 용지 기준으로 바꾼다.

---

## 3. 용지별 기하 값

기준: `LINE_PX = 34.56px`(18px × 1.92) ≈ **9.144mm**(CSS 96dpi 환산). 상하 여백 각 **25mm**(좌우와 대칭), 즉 상하 합 50mm.

`N = floor((용지높이mm − 50) / 9.144)`:

| 용지 | 용지높이 | 본문 N줄 (현재 → 신규) | 본문 높이(N×9.144mm) |
|---|---|---|---|
| A4 | 297mm | 26 → **27** | ≈ 246.9mm |
| B4 | 364mm | 32 → **34** | ≈ 310.9mm |
| A3 | 420mm | 37 → **40** | ≈ 365.8mm |
| A2 | 594mm | 52 → **59** | ≈ 539.5mm |

- **sheet 높이 = 진짜 용지 높이**(297/364/420/594mm). 현 양식화값(256mm 등) 폐기.
- 상단 여백 25mm + 본문 N줄 + 하단 여백(잔여) = 용지 높이. 하단 여백은 25mm 근처에서 줄높이 미정합분을 흡수(정확히 25mm 아닐 수 있음 — baseline grid 정상 동작).
- 책상 간격(sheet 사이 gap)은 현행 시각 유지(예: 고정 px 또는 소량) — plan 에서 현 `strideLines` 와 정합.

> mm↔px 정밀 환산·반올림·`stridePx`/`sheetHpx`/여백 px 계산은 **plan 단계에서 단위 테스트로 고정**한다(현 `pageLayout.test.ts` 패턴 재사용).

---

## 4. 변경 범위 (메커니즘 불변, 기하만)

| 파일 | 변경 |
|---|---|
| `frontend/src/components/editor/pageLayout.ts` | `PAPER_PRESETS`/`paperGeometry`/`PaperGeometry` 타입 — `bodyLines`=N, `sheetHpx`=진짜 용지높이(px), `pageHpx`=N×LINE_PX, 상하여백 필드 추가. `pageCount`/`globalLineAt`/`pageNumberTopsPx` 파생 정합 |
| `frontend/src/components/editor/pageLayout.test.ts` | 새 기하 값(N줄·진짜 sheet 높이·파생) 회귀 테스트로 고정 |
| `frontend/src/components/editor/paper-editor.css` (A형) | `--page-h`(N줄)·sheet 높이(진짜 A4)·줄노트 본문영역 정렬. A형은 **A4 고정** |
| `frontend/src/components/editor/PaperEditor.tsx` (A형) | `A4_GEOMETRY` 새 A4 값. 인라인 주입 필요 시 정합(현 CSS 하드코딩 → geometry 정합) |
| `frontend/src/app/b/b.css` + `frontend/src/components/b/BEditor.tsx` (B형) | B형은 이미 `paperGeometry` 인라인 주입(`--b-page-h`/`--b-page-stride`) → pageLayout 변경 **자동 반영**. b.css fallback calc 동기 |

**불변(접촉 금지):** `column-wrap` 분할 메커니즘 · 한국어 IME 가드(`view.composing`) · 자동저장(`useDocumentSession`/draft) · 세션 · `CSS.supports` 폴백(미지원 브라우저 흐름형). → **가장 위험한 영역 미접촉, 회귀 위험 낮음.**

---

## 5. PDF Export 연계 (023 Phase 3 재개)

본 재설계 완료 후, 023 Phase 3 PDF 본구현을 **같은 진짜 A4 모델**로 재개:
- **방법 B(인쇄 전용 재구성)** — `@page { size: A4; margin }` + 페이지당 본문 N줄 + `break-after: page`. 본문 영역·줄높이·여백이 화면과 동일하므로 **화면 = PDF** 정합.
- 화면이 진짜 A4 가 됐으므로 인쇄와 페이지 경계가 자연 일치(방법 A 실패 원인 해소).

---

## 6. 비범위 (Out of Scope)

- **A형 용지 4종 동적 선택** — A형은 A4 고정 유지. (B형만 4종, 현행)
- 화면 줌(`zoom`/`fitZoom`) 레이어 변경 — 기하와 별개, 불변.
- export 자체(PDF/DOCX/HWPX) 구현 — 본 spec 은 페이지 모델만. export 는 023 plan.
- 원고지(격자) 모드 — 본 재설계 대상 아님.
- 운영 배포·백엔드 변경 — 프론트 CSS/기하 only.

---

## 7. 검증

- **단위:** `pageLayout.test.ts` — 용지별 N줄(27/34/40/59)·진짜 sheet 높이·`pageCount`/`pageNumberTopsPx` 파생값 고정.
- **dogfooding (사용자):**
  1. 화면 줄노트가 **페이지마다 같은 위치에 정렬**(경계 어긋남 0)
  2. 화면 세로가 진짜 A4 비율
  3. **한국어 IME 4케이스 회귀 0**(PoC 0-1 재사용 — 빠른타자·조합중 mark·한자변환·backspace 분해)
  4. 자동저장/세션/거짓충돌 회귀 0
  5. (Phase 3 후) PDF 가 화면과 페이지 경계·괘선·여백 일치

---

## 8. Trade-off / 리스크

- **화면 세로 +16%**(256→297mm) — PDF 일치를 위한 의도된 변화(사용자 감수).
- N줄이 용지를 정확히 꽉 채우지 않음(A4 27줄=246.9mm 본문 + 미세 하단여백) — baseline grid 정상 동작.
- CSS 26줄 하드코딩이 **두 곳**(`paper-editor.css`·`b.css`) + JS(`pageLayout.ts`)에 분산 → 세 곳 동기 변경 필수(누락 시 화면/계산 불일치). plan 에서 한 번에.
- B형은 geometry 자동 반영이나 b.css fallback calc 정합 누락 위험 → 확인 task.

---

## 9. 인접 문서

- export 설계: `docs/superpowers/specs/2026-06-14-export-design.ko.md`
- export 계획: `docs/superpowers/plans/2026-06-14-export.md` (Phase 3 = 본 재설계 후 재개)
- PDF PoC(방법 A 실패 기록): `docs/poc/2026-06-14-pdf-print-fidelity.md`
- 페이지 분할 PoC(원본 채택 근거): `docs/poc/0-4-page-split-poc-plan.md`
- 현 기하: `frontend/src/components/editor/pageLayout.ts`
