# Implementation Plan: Round 2 — B 집필실 페이지 분할·용지·반응형

**Branch**: `020-round2-b-studio` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)

## Summary

B 집필실(`app/b/works/[id]`)에 A PaperEditor의 검증된 CSS column-split 페이지 분할을 **B 스킨으로** 이식하고, 용지 4종(A4/A3/A2/B4)을 설정 영속으로 고르게 한다. 좁은 폭 패널 drawer화, H3 목차 반영을 곁들인다. 백엔드 변경은 설정 allowlist 1줄뿐(스키마·엔티티·엔드포인트 신규 0).

기술 접근은 deep-research(2026-06-12) + 코드 실측 기반:
- **분할 메커니즘**: `.ProseMirror` column-width/column-height/column-wrap:wrap → 브라우저가 장 단위 레이아웃. 줄선은 `.ProseMirror` 배경이 아니라 **절대배치 `.sheet` 요소**로 분리(현 b.css의 흐름형 배경 gradient를 페이지별 시트로 이전). A PaperEditor가 검증한 패턴.
- **기하**: `pageLayout.ts`의 A4 하드코딩 상수(26줄·30보폭)를 `PaperGeometry` 파라미터로 추출. A4는 **현 상수와 수치 동일**(회귀 0), 나머지는 용지 height 비율로 줄수 스케일.
- **폴백**: `CSS.supports('column-height','1px')` → false면 현행 B 흐름형 유지(분할/시트 미렌더).

## Constitution Check

constitution은 템플릿 미비준. 실효 게이트(CLAUDE.md HARD-GATE + `.claude/rules/`) 적용:

| 게이트 | 적용 | 상태 |
|---|---|---|
| external-infra-safety | 마이그레이션 0(기존 user_settings 재사용). 운영 쓰기 없음 | ✅ N/A |
| 빌드/테스트 포어그라운드 | `pnpm test`·`pnpm build`·`./gradlew test` foreground | ✅ |
| TS code-quality(RSC·any·status) | 신규 컴포넌트 `'use client'`, status 분기 신규 0, any 0 | ✅ |
| Kotlin code-quality | SettingsService.ALLOWED 1줄 추가만(기존 패턴) | ✅ |
| 한국어 검증 cadence | TipTap 렌더 변경 → IME 4케이스 dogfooding 의무 | ⚠️ human gate |
| agent-workflow-discipline §5·§6 | 파일명·시그니처 실측 grep 완료(아래 실측 표) | ✅ |

## 실측(grep 확정) — 변경 대상

| 파일 | 현 상태 | 변경 |
|---|---|---|
| `frontend/src/components/editor/pageLayout.ts` | A4 상수 하드코딩(LINE_PX·PAGE_STRIDE_PX·SHEET_H_PX, pageCount/globalLineAt/pageNumberTopsPx) | `PaperGeometry` 파라미터화. A4 backward-compat 보존 |
| `frontend/src/components/b/BEditor.tsx` | 흐름형 `.b-editor-scroll > EditorContent`. useEditor+IME 가드 보유 | paged 분기 추가(sheets·page-num·ResizeObserver·click-fill), 폴백 시 현행 |
| `frontend/src/app/b/b.css` | `.b-editor .ProseMirror` 배경 gradient 줄선(흐름형) | paged 스킨 추가(`.sheet`·column CSS·`@supports`). 흐름형은 폴백으로 유지 |
| `frontend/src/app/b/works/[id]/page.tsx` | BEditor 호출, paperSize 미전달 | paperSize→geometry 계산 후 BEditor에 전달 |
| 목차 H3(3곳, grep 확정) | `lib/editor/outline.ts`(순수파생+테스트) / `useEditorOutline.ts:52` `querySelectorAll("h1, h2")` / `:82` 점프필터 `level===1\|\|2` | 3곳 모두 H3 포함 |
| `frontend/src/stores/preferences.ts` | theme·writingMode·manuscriptSize·design | `paperSize: PaperSize` 추가(default "A4") |
| `frontend/src/components/PreferencesSync.tsx` | theme·writingMode·manuscriptSize 직렬화 | paperSize 직렬화·hydrate 추가 |
| `frontend/src/lib/api/settings.ts` | (직렬화는 PreferencesSync) | 변경 없을 수 있음(맵 기반) |
| `backend/.../service/SettingsService.kt` | ALLOWED 3키 | `"paperSize" to setOf("A4","A3","A2","B4")` 1줄 |
| `frontend/src/app/b/settings/page.tsx` | 테마·작성모드 등 | 용지 선택 UI 추가 |
| `frontend/src/components/b/BWorkSidePanel.tsx` + works page | 반응형 전무 | drawer/토글(US2) |

## 핵심 계약 — PaperGeometry 파라미터화 (구현자 필독)

### 용지 프리셋 (portrait, stylized 모델)

기존 A4 기하는 **metric 정확이 아니라 줄수 정수 모델**이다(A4 sheet = 28줄 ≈ 256mm ≠ 297mm). 이 모델을 보존하며 용지 height 비율로 본문 줄수만 스케일:

| 용지 | widthMm | heightMm | bodyLines | 산출 근거 |
|---|---|---|---|---|
| A4 | 210 | 297 | **26** | 현행 그대로(회귀 0 기준) |
| B4(JIS) | 257 | 364 | 32 | 26×(364/297)=31.9→32 |
| A3 | 297 | 420 | 37 | 26×(420/297)=36.8→37 |
| A2 | 420 | 594 | 52 | 26×(594/297)=52.0 |

> B4 = **JIS 257×364mm**(한국 인쇄 관행). ISO B4(250×353)와 다름 — 확정.

### 파생 공식 (용지 무관, bodyLines로부터)

```
LINE_PX = 18 * 1.92 = 34.56           // 폰트 기반, 용지 무관 — 불변
sheetLines  = bodyLines + 2           // 본문 + 상하 패딩 1줄씩 (A4: 28)
strideLines = bodyLines + 4           // 시트 + 책상 간격 2줄    (A4: 30)
pageH_px   = bodyLines  * LINE_PX     // = column-height       (A4: 26*34.56)
sheetH_px  = sheetLines * LINE_PX     // .sheet 높이            (A4: 28*34.56)
stride_px  = strideLines* LINE_PX     // 보폭                   (A4: 30*34.56)
colWidthMm = widthMm - 50             // 좌우 25mm 여백          (A4: 160)
maxWidthMm = widthMm
```

A4(bodyLines 26)을 대입하면 현 상수(SHEET_H=28*LINE, STRIDE=30*LINE, page-h=26*LINE, col-width=160mm, max-width=210mm)와 **완전 일치** → A PaperEditor 회귀 0.

### pageLayout.ts 리팩토링 계약

- `export type PaperSize = "A4" | "A3" | "A2" | "B4"`
- `export type PaperGeometry = { bodyLines; sheetLines; strideLines; pageHpx; sheetHpx; stridePx; colWidthMm; maxWidthMm }`
- `export const PAPER_PRESETS: Record<PaperSize, {widthMm; heightMm; bodyLines}>` (위 표)
- `export function paperGeometry(size: PaperSize): PaperGeometry` (위 공식, 순수함수)
- 기존 함수 시그니처에 geometry 주입:
  - `pageCount(flowHeightPx, zoom, stridePx)` — 현 PAGE_STRIDE_PX 상수 → 인자
  - `globalLineAt(linesFromTop, bodyLines, strideLines)`
  - `pageNumberTopsPx(count, stridePx, sheetHpx)`
- **A PaperEditor 호출부 갱신**: `paperGeometry("A4")`를 넘기도록(또는 A4 기본 인자) — 동작 불변 보장. 기존 `LINE_PX` export는 유지.
- **TDD**: 각 용지 geometry 산출 + A4 회귀(현 상수와 동일) 단위 테스트 우선(RED→GREEN).

### CSS 변수 주입 (b.css paged)

geometry를 React에서 inline custom property로 주입(PaperEditor의 `--zoom` 패턴):
```
style={{ '--bp-line': `${LINE_PX}px`, '--bp-page-h': `${g.pageHpx}px`,
         '--bp-stride': `${g.stridePx}px`, '--bp-col-width': `${g.colWidthMm}mm`,
         '--bp-max-width': `${g.maxWidthMm}mm` }}
```
b.css paged 규칙은 이 변수 참조. 흐름형(`.b-editor` 현행)은 `@supports not (column-height: 1px)` 또는 JS 폴백 분기에서 유지.

## 구현 단계 (PoC-first, §10)

> **§10**: 양보불가 핵심(B에서의 페이지 분할+한글)을 **첫 dogfoodable 산출물**에서 증명. 용지/설정/반응형은 그 뒤.

### Phase 1 — 분할 PoC (핵심 증명, 최우선)
B 본문에 A4 분할만 이식(용지 선택·설정 없이 하드코딩 A4). 시트·쪽번호·column-split·click-fill·폴백 분기. **첫 브라우저 dogfooding 게이트**: 한글 입력+IME 4케이스+장 분할 육안. b.css 줄선↔column 충돌이 최대 리스크 — 여기서 표면화.

### Phase 2 — 기하 파라미터화 + 용지 4종
pageLayout.ts PaperGeometry 리팩토링(TDD, A4 회귀) → BEditor가 geometry prop 수용 → 4종 geometry 산출 검증.

### Phase 3 — 설정 영속
preferences store `paperSize` + PreferencesSync 직렬화 + 백엔드 ALLOWED 1줄 + `/b/settings` UI. works page가 설정값→geometry→BEditor 배선.

### Phase 4 — 좁은 폭 패널(US2)
좌 목차·우 BWorkSidePanel breakpoint 미만 drawer/토글.

### Phase 5 — 검증 격차(US3) + 게이트
H3 목차 반영, 헤더 네비 영속 확인, 전체 게이트(vitest·tsc·eslint·build / backend ktlint·checkstyle·test·build), A 동결 기록.

## 리스크

| 리스크 | 완화 |
|---|---|
| b.css 줄선 gradient ↔ column-split 시각 충돌 | Phase 1 PoC 조기 dogfooding. 줄선을 `.sheet` 절대배치로 이전(A 패턴) |
| `column-height` Chrome 145+ 전용(검증 3-0) | CSS.supports 폴백 → 흐름형. Safari/Firefox 깨짐 0 |
| IME 회귀(렌더 구조 변경) | onUpdate 가드 불변(구조상 보존) + 4케이스 human dogfooding |
| A2 52줄 = 매우 긴 시트 | 의도된 동작(큰 용지=장당 다량). 줌으로 완화 |

## Complexity Tracking
위반 없음 — 비움.
