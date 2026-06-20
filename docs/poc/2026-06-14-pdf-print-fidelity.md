# PoC: PDF 인쇄 정합 후보 (#51)

작성일: 2026-06-14  
담당: 자동 빌드 검증 + 사용자 dogfooding 필요  
관련 이슈: #51 (Round 3 export 선행 조사)

---

## (a) 두 후보 방법

### 방법 A — 화면 그대로 + `@media print`

현재 집필실 화면과 **동일한 마크업/CSS** 를 사용하고, `@media print` 블록으로 책상 배경·그림자·툴바만 제거한다. 핵심 레이아웃인 `.ProseMirror` 의 `column-width: 160mm` + `column-height: var(--page-h)` + `column-wrap: wrap` (Chrome 145+ 비표준) 을 그대로 둔다.

**관찰 대상**: 브라우저 인쇄 엔진이 `column-wrap` 의 각 "열(column)" 을 별도 인쇄 페이지로 매핑하는가. 이것이 성립하면 화면 분할 위치 = PDF 페이지 구분이 자동으로 보장된다.

**위험**: `column-height` / `column-wrap` 은 W3C CSS Multicol spec 에 없는 비표준 확장이다. 인쇄 경로에서는 브라우저가 화면과 다른 레이아웃 엔진을 쓸 수 있어 column 분할이 무시되거나 모든 본문이 한 페이지에 흘러들 가능성이 있다.

### 방법 B — 인쇄 전용 재구성 (`break-after: page`)

`@page { size: A4 portrait; margin: 25mm }` + 각 "장(章)" 을 별도 `<div>` 로 분리하고 `break-after: page` 를 명시한다. 화면용 DOM 은 `.paper-editor` 마크업으로 근사 미리보기를 제공하고, 인쇄 시에는 별도의 인쇄 전용 DOM 으로 전환한다(`@media screen { display:none }` / `@media print { display:block }`).

**강점**: W3C CSS Paged Media spec 기반이라 모든 브라우저 인쇄 경로에서 페이지 구분이 안정적으로 동작한다. 페이지 구분 위치는 명시적(단락 단위 분할)이다.

**단점 / 과제**: "화면의 column 분할 위치"와 "인쇄의 단락 단위 분할 위치"가 다를 수 있다. 특히 긴 단락이 화면에서 중간에 잘리는 경우, 방법 B 에서는 단락 전체가 한 페이지에 들어가거나 다음 페이지로 통째로 넘어간다. 이를 화면과 정확히 맞추려면 ProseMirror 레이아웃 측정 결과를 기반으로 "각 인쇄 페이지에 어떤 내용이 들어가는가"를 JS 로 재계산해야 한다 (Phase 3 핵심 구현 과제).

---

## (b) 자동 검증 완료 항목 vs 사용자 측정 필요 항목

### 자동 검증 완료 (GREEN)

| 항목 | 결과 |
|---|---|
| `tsc --noEmit` | 오류 없음 |
| `pnpm build` (Next.js 16 Turbopack) | GREEN — `/poc/export-print` 정적 라우트로 등록 |
| `paper-editor.css` import 및 `paperGeometry("A4")` 호출 | 빌드 통과 |
| React 타입 (`breakAfter`, `columnWidth` 등 CSS 속성) | TypeScript 오류 없음 |

### 사용자 직접 측정 필요 (자동 불가)

| 항목 | 이유 |
|---|---|
| 방법 A: column-wrap 인쇄 시 페이지 구분 실제 동작 여부 | 비표준 CSS — 헤드리스 렌더 없이 픽셀 검증 불가 |
| 방법 B: `break-after: page` 가 PDF 에서 예상 위치에 구분을 생성하는지 | PDF 시각적 내용 확인 필요 |
| 명조체(`--pe-serif`, Nanum Myeongjo) 가 PDF 에 임베드/표시되는지 | OS·브라우저 폰트 렌더 환경 종속 |
| 화면의 줄노트(lined) 와 PDF 의 줄 정렬 일치 여부 | 시각 비교 필요 |
| 방법 A vs B 에서 동일 단락의 페이지 구분 위치가 다른지 | 핵심 측정 포인트 |

---

## (c) 사용자 dogfooding 절차

### 준비

```bash
cd frontend
pnpm dev
```

브라우저에서 `http://localhost:3000/poc/export-print` 접속.

### 방법 A 테스트

1. 라디오 버튼 **"방법 A — 화면 그대로 + @media print"** 선택 확인
2. 화면에서 약 3장 분량의 본문이 종이 배경 위에 분할되어 표시되는지 확인
3. **"인쇄 (PDF 저장)"** 버튼 클릭 → 브라우저 인쇄 대화상자
4. 대상: **PDF 로 저장**, 종이 크기: A4, 여백: 없음(또는 최소)으로 설정 후 저장
5. PDF 열어 확인:
   - **총 페이지 수**: 3페이지인가? (화면에서 3장)
   - **페이지 구분 위치**: 화면의 장(章) 구분과 일치하는가?
   - **폰트**: 명조체(Nanum Myeongjo 또는 유사 세리프)로 표시되는가?
   - **줄노트(가로 선)**: 인쇄에 포함되는가? (포함 여부 확인 용도)

### 방법 B 테스트

1. 라디오 버튼 **"방법 B — 인쇄 전용 재구성"** 선택
2. 화면에서 3개 별도 종이 블록이 순차 표시되는지 확인
3. **"인쇄 (PDF 저장)"** 클릭 → 동일하게 PDF 저장
4. PDF 열어 확인 (방법 A 와 동일 항목):
   - **총 페이지 수**: 3페이지
   - **페이지 구분 위치**: 각 단락 묶음의 경계에 구분이 생기는가?
   - **폰트**: 명조체 표시 여부
   - **여백**: A4 25mm 여백이 적용되었는가?

### 비교 체크리스트

| 항목 | 방법 A | 방법 B |
|---|---|---|
| 총 페이지 수 = 3 | ☐ | ☐ |
| 화면 장 구분과 PDF 페이지 구분 일치 | ☐ | — (다를 수 있음) |
| 명조체 표시 | ☐ | ☐ |
| 줄노트 인쇄 포함 | ☐ | N/A |
| 여백(25mm) 정합 | ☐ | ☐ |

---

## (d) 엔지니어링 권장 (사용자 확인 대기)

**현재 권장: 방법 B (인쇄 전용 재구성) — 단, 정밀 페이지 분할 재계산 필요**

이유:

1. **`column-wrap`의 인쇄 경로 신뢰도 미확인**: `column-height` + `column-wrap` 은 W3C 표준이 아니다. Chrome 인쇄 엔진이 화면 Blink 렌더와 같은 비표준 CSS 를 동일하게 처리한다는 보장이 없다. 방법 A 가 화면과 같은 위치에 페이지 구분을 생성한다면 이상적이지만, 실패 시 모든 본문이 1페이지에 흘러들거나 분할 위치가 어긋날 위험이 있다.

2. **방법 B 는 표준 인쇄 spec 기반**: `@page` + `break-after: page` 는 CSS Paged Media spec 의 안정 기능으로, 모든 주요 브라우저 인쇄 경로에서 동작한다.

3. **방법 B 의 핵심 과제**: 화면의 `column-wrap` 분할 위치(ProseMirror 측정값 기반)와 인쇄의 단락 경계 분할이 다를 수 있다. 이를 해결하려면 Phase 3 에서 **ProseMirror DOM 측정 결과를 기반으로 각 인쇄 페이지에 들어갈 콘텐츠 범위를 JS 로 계산** 하고, 그 범위별로 인쇄 전용 DOM 을 재구성하는 로직이 필요하다.

4. **방법 A 가 dogfooding 에서 통과한다면**: 구현 비용이 월등히 낮으므로 방법 A 우선 채택. 그러나 비표준 CSS 의존이라 Chrome 버전 업에서 깨질 위험을 기술 부채로 명시해야 한다.

**이 판단은 dogfooding 결과 확인 전까지 잠정적이다.**

---

## (e) Phase 3 본구현 윤곽

### 방법 A 채택 시

- 수정 파일: `src/components/editor/paper-editor.css` 에 `@media print` 블록 추가
- `src/components/editor/PaperEditor.tsx` 에 "PDF 저장" 버튼 또는 키보드 단축키 추가
- `src/app/projects/[id]/write/page.tsx` 에 인쇄 트리거 UI 추가
- 추가 작업: 줄노트(lined) 인쇄 포함/제외 선택 옵션

### 방법 B 채택 시 (추가 구현 필요)

- 신규 파일: `src/components/editor/PrintView.tsx` — ProseMirror JSON + DOM 측정값을 받아 페이지 단위 인쇄 DOM 생성
- 신규 파일: `src/components/editor/printLayout.ts` — 각 ProseMirror 노드의 측정 높이를 `pageHpx` 기준으로 페이지 단위 분할하는 순수함수 (pageLayout.ts 와 정합)
- 수정 파일: `PaperEditor.tsx` — ResizeObserver 측정값을 `PrintView` 에 전달하는 prop/ref 추가
- `@media print` 에서 `PrintView` 표시, `PaperEditor` 숨김
- 테스트: `printLayout.ts` 단위 테스트 (Vitest)

### 공통

- `window.print()` 호출 전 `document.title` 을 "작품명_챕터명" 으로 설정 → PDF 파일명 자동화
- 인쇄 중 toast/spinner 숨김 처리

---

## 기술 메모

- **`generateHTML` 미사용**: `@tiptap/core` 미설치 (설치된 패키지: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`). PoC 에서는 정적 한국어 더미 본문으로 대체. Phase 3 에서 실제 `editor.getJSON()` 기반 본문이 필요하면 `PaperEditor` 내부 인쇄 트리거로 구현하면 `generateHTML` 불필요.
- **신규 npm 의존성 없음**: PoC 에서 추가 패키지 없음.
- **PoC 라우트 위치**: `src/app/(poc)/poc/export-print/page.tsx` — Phase 3 본구현 시 제거 또는 정식화 예정.
