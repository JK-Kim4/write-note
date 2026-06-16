# R7 Export (023 Round 3) — 작품 내보내기 설계

> 작성 2026-06-16 · 브랜치 `023-export` · 자체 EditContext 엔진 전면 교체(R3~R6) 위에서 진입.

## 1. 배경·전제

작품의 챕터들을 골라 묶어 **PDF / HWPX / DOCX** 로 내보낸다.

- **대전제 변경**: 이전 export 설계(`docs/superpowers/specs/2026-06-14-export-design.ko.md`)는 TipTap + CSS `column-wrap` 시절 산물이다. R3~R6 에서 TipTap 이 완전 폐기되고 A·B 양쪽 집필실이 **자체 EditContext 엔진**(JS 가 측정→배치→렌더)으로 교체됐다(`grep @tiptap src`=0). 따라서 이전 설계의 **PDF = 화면 column-wrap + @media print** 계열 접근은 무효이며, R7 PDF 는 **자체 엔진의 페이지 모델**에서 생성한다.
- **계승**: 이전 설계의 HWPX 실현가능성(hwpxlib), 워드 문서는 형식·구조 보존, ExportDialog 골격, `collectChapters` 헬퍼는 유효하다.
- **현재 상태**: `ExportDialog` UI 골격만 존재(PDF 버튼만 활성, `onExportPdf` placeholder). `.export-dialog` CSS 전무. 생성 로직 0. ExportDialog 는 A·B 공통 셸(`BStudioShell`)에 `onExport`→열림 결선됨(R4) — 열림/닫힘/챕터 목록은 동작.

## 2. 본질 결정 (인터뷰 합의)

| # | 결정 | 값 |
|---|---|---|
| 1 | 포맷 범위 | **PDF + HWPX + DOCX** 세 포맷 전부 |
| 2 | PDF 생성 방식 | **브라우저 인쇄 정합** — `layout()` 이 나눈 페이지를 DOM 으로 렌더 + `@page`/`break-after` → `window.print()` → 사용자가 PDF 저장 |
| 3 | 워드(HWPX·DOCX) 생성 위치 | **백엔드 단일** — hwpxlib 가 JVM 라이브러리라 클라 생성 불가 → 백엔드 불가피. DOCX(Apache POI)도 같은 백엔드 경로에 합쳐 PM→워드 매핑 로직 공유 |
| 4 | 워드 경로 중간 표현 | **프론트에서 `ExportDoc` DTO 로 변환 후 JSON POST** — PM JSON 을 백엔드로 보내 파싱시키지 않음 |
| 5 | 챕터 합본 구조 | ExportDialog 에서 **사용자 선택**, default = **챕터마다 새 페이지 + 제목(책 형식)** |
| 6 | 줄노트(괘선) 포함 | ExportDialog `lined` 토글(기존) — PDF 출력 시 괘선 그릴지 선택값 |

### PDF 방식 근거 (과거 2회 실패와의 차이)

과거 실패의 원인은 **브라우저(column-wrap)가 페이지 분할을 담당**한 것이었다. 자체 엔진 교체로 `layout(blocks, contentHeightPx)`(순수함수)가 **페이지 분할을 JS 로 직접 결정**(`LaidOutPage[]` 반환)하므로, 각 페이지를 고정 크기 컨테이너로 박아 `break-after:page` 로 끊으면 **브라우저는 분할 결정권이 없다**. 이것이 결정적 차이다. (단 폰트 렌더 미세차로 페이지 컨테이너 내용이 넘칠 수 있어 **PoC 게이트로 실측** 필요.)

## 3. 아키텍처

```
[공통]  collectChapters(PM JSON 수집)  +  ExportDialog(포맷·챕터선택/순서·합본모드·줄노트)
           │
           ├─ PDF  ── 클라 전량 ── 수집 DocModel → measure(geometry·본문폰트) → layout() → 페이지별 인쇄 DOM(@page/break-after) → window.print()
           │                         ※ 백엔드 0. 에디터와 동일 geometry·fontFamily 공유(줄·페이지 정합)
           │
           └─ HWPX/DOCX ── 백엔드 ── 프론트가 ExportDoc DTO 변환 → POST → hwpxlib(HWPX)/Apache POI(DOCX) 생성 → 파일(blob) 다운로드
```

세 경로 모두 **공통 수집(`collectChapters`) + 공통 다이얼로그(`ExportDialog`)** 를 통과한다. PDF 는 자체 엔진 모듈 재사용으로 클라에서 닫히고, 워드 둘은 백엔드 단일 endpoint 로 묶인다.

## 4. 컴포넌트 상세

### 4-1. 공통 — 수집·변환 레이어 (프론트)

- **`collectChapters(orderedIds, fetchDoc)` → `CollectedChapter[]`** (기존, 재사용)
  - `CollectedChapter = { id: number; title: string; bodyJson: string }` (`bodyJson` = `DocumentResponse.body`, PM JSON 문자열)
  - 선택 챕터를 순서대로 `getDocument(id)` 호출로 수집 — 신규 endpoint 불필요.
- **신규 `toExportDoc(chapters, opts)` → `ExportDoc`** — PM JSON → 변환 (§5). `pmConvert.pmJsonToModel` + `DocModel`(buffer/blockAttrs/markRuns) 재사용.

### 4-2. PDF — 클라 인쇄 경로

- 수집한 각 챕터의 `bodyJson` → `pmJsonToModel` → `DocModel`.
- **에디터와 동일** `geometry`(작품 `paperSize`, 본문 fontSizePx) + `fontFamily` 로 `measure`(오프스크린 DOM 측정, `document.body` 부착) → `MeasuredBlock[]`.
- `layout(measured, contentHeightPx)` → `LaidOutPage[]`(페이지별 `PlacedFragment[]`).
- **인쇄 전용 렌더** — 각 `LaidOutPage` 를 고정 크기(`pageWidthPx × pageHeightPx`) 컨테이너 div 로 렌더, 페이지 사이 `break-after: page`, `@page { size: <paperSize> portrait; margin: 0 }` (마진은 geometry 가 이미 contentHeight 에 반영). 챕터 합본 모드(§5)에 따라 챕터 경계에 page-break/제목 삽입.
- `lined=true` 면 괘선(가로 줄) 배경을 페이지에 그림(에디터 줄노트와 동일 stride).
- `window.print()` 호출 → 사용자가 인쇄 대화상자에서 "PDF 로 저장".
- **geometry 출처 통일 (정합 이슈)**: 현재 `ExportDialog` 는 `@/components/editor/pageLayout` 의 `PaperSize`(A4/A3/A2/B4)를 import 하나, 자체 엔진은 `custom-editor/geometry` 의 `PaperSize`(A5 포함)를 쓴다. PDF 경로는 **`custom-editor/geometry` 로 단일화**하고 `ExportDialog` import 도 그쪽으로 변경한다. (`editor/pageLayout` 은 TipTap 폐기 후 잔존 모듈 — 본 작업에서 PDF 가 의존을 끊고, 완전 제거는 별도 정리 트랙.)

### 4-3. HWPX/DOCX — 백엔드 경로

- **프론트**: `ExportDoc` DTO 를 `POST /api/export/hwpx` / `POST /api/export/docx` 로 전송 → 응답 blob 다운로드(`Content-Disposition`).
- **백엔드**: DTO → 생성 라이브러리 매핑만.
  - HWPX: `kr.dogfoot:hwpxlib:1.0.5` (Maven Central, 스파이크 `0d46664` 검증 — 단락·bold/italic·한글폰트 ✅, 제목스타일·용지크기 ⚠️ 한컴 렌더 dogfooding 확인).
  - DOCX: Apache POI `XWPF` (.docx 생성 표준 Java 라이브러리, 유니코드/한글 지원).
- 매핑 대상: 챕터 → (합본 모드에 따라) 섹션/페이지 구분 + 제목, 블록 type(paragraph/heading 1~3/blockquote/listItem bullet·ordered/hr), 마크(bold/italic/underline/strike).
- 스파이크 산출물: `docs/poc/2026-06-14-hwpx-spike.md`, `backend/src/test/kotlin/com/writenote/spike/HwpxSpikeTest.kt`(Phase 2 에서 본구현으로 승격).

## 5. 중간 표현 — `ExportDoc` DTO

```ts
type ExportBlock = {
  type: "paragraph" | "heading" | "blockquote" | "listItem" | "hr";
  level?: 1 | 2 | 3;                       // heading 일 때
  listKind?: "bullet" | "ordered";          // listItem 일 때
  depth?: number;                           // listItem 일 때
  text: string;                             // 소프트 줄바꿈은 \n 으로 정규화
  marks: { start: number; end: number; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean }[];
};
type ExportChapter = { title: string; blocks: ExportBlock[] };
type ExportDoc = {
  paperSize: PaperSize;
  joinMode: "page-title" | "inline-title" | "body-only";  // §2-5, default page-title
  chapters: ExportChapter[];
};
```

- `marks` 의 `start`/`end` 는 해당 `text`(소프트 줄바꿈 `\n` 정규화 후) 기준 문자 offset.
- 변환 출처: `pmJsonToModel(bodyJson)` → `DocModel`(buffer/blockAttrs/markRuns) → `ExportBlock[]`. blockAttrs → type/level/listKind/depth, markRuns(비트마스크 run) → marks 구간.
- **이유**: PM JSON 파싱 복잡성을 프론트의 검증된 `pmConvert`/`DocModel` 에 둬 백엔드를 DTO→라이브러리 매핑만으로 단순화 → 백엔드 단위 테스트·검증이 쉬워진다.
- `joinMode` 는 백엔드(워드 섹션/페이지 구분)·프론트(PDF page-break 삽입) 양쪽이 같은 플래그로 해석.

## 6. ExportDialog 확장

기존 props(`open`, `chapters`, `paperSize`, `onClose`) 유지 + 변경:

- 포맷 버튼 3개 **전부 활성**(현재 PDF 만).
- **합본 모드 셀렉트** 추가 — `page-title`(책 형식, default) / `inline-title` / `body-only`.
- 핸들러 2갈래: `onExportPdf(req)`(클라 인쇄) + `onExportWord(format, req)`(백엔드 호출·blob 다운로드). `req` 에 `orderedIds`·`lined`·`joinMode` 포함.
- **`.export-dialog` CSS 신설** — 모달 오버레이(백드롭·ESC·focus trap, 기존 `useModalDismiss` 재사용 검토) + 레이아웃(포맷 탭·챕터 목록·옵션·액션).
- 마운트 계약 유지 — 부모는 `{open && <ExportDialog/>}` 조건부 마운트(stale 방지).

## 7. Phase 분해 (포맷별 독립 dogfooding 게이트)

| Phase | 내용 | 게이트 |
|---|---|---|
| **0** 공통 | `ExportDialog` 확장(포맷 활성·합본 모드·CSS) + `toExportDoc` 변환(프론트, 순수) + geometry 출처 통일 | TDD 순수 GREEN |
| **1** PDF | 클라 생성(measure→layout→인쇄 DOM→`window.print`) + 괘선·합본 모드·`@page` | **PoC 게이트** — 사용자 인쇄 실측(페이지 넘침·줄정합·합본 경계). Claude 시각 검증 불가 |
| **2** 워드 | 백엔드 endpoint 2개 + HWPX(hwpxlib 승격)·DOCX(POI) 매핑 + 프론트 blob 다운로드 | dogfooding — 한컴오피스(HWPX)·MS Word(DOCX) 실제 열림 확인 |

각 Phase 독립 게이트. Phase 1 의 PoC 게이트 통과 전 Phase 2 진입 무관(병행 가능하나 PDF 가 핵심 사용자 요구라 선행 권장).

## 8. 테스트 전략

- **순수(프론트, TDD)**: `toExportDoc` 변환(PM JSON→ExportDoc, blockAttrs/markRuns→type/marks 매핑), 합본 모드 삽입 규칙, `collectChapters`(기존 테스트 유지).
- **백엔드(JUnit, TDD)**: DTO→hwpxlib/POI 매핑 단위 + 생성 파일 구조 검증(스파이크 `HwpxSpikeTest` 패턴 재사용 — 생성된 hwpx/docx 의 단락·제목·마크 노드 존재 assert).
- **PDF 시각**: 사용자 dogfooding 전담(Claude 는 인쇄 결과 시각 검증 불가 — 명시).
- **게이트**: 프론트 `tsc · vitest(src/lib/export · src/components/export · src/components/custom-editor) · build`, 백엔드 `ktlint(main+test) · checkstyle · test · build` 포어그라운드.

## 9. 범위·위험·미해결

**범위 밖**: 등장인물·메모 등 설정자료 export(본문 챕터만), 표지·목차 자동생성, 페이지 번호 커스터마이즈, PDF 라이브러리 직접 생성(방식 B/C 폐기).

**위험**:
- (PDF) 폰트 렌더 미세차로 인쇄 시 페이지 컨테이너 내용 넘침 — PoC 게이트로 조기 차단. 화면 measure 와 인쇄 measure 의 폰트·DPI 정합 확인.
- (HWPX) 제목 스타일·용지 크기가 한컴오피스에서 의도대로 렌더되는지 미검증(스파이크 ⚠️) — Phase 2 dogfooding 게이트.
- (백엔드) 신규 `/api/export/*` endpoint — 인증·권한(작품 소유자만)·요청 크기 제한 확인.

**미해결(plan/구현 단계 확정)**: `useModalDismiss` 재사용 가능 여부, blob 다운로드 시 파일명(작품 제목 기반) 규칙, `editor/pageLayout` 완전 제거 시점(별도 정리 트랙).

## 10. 참고 자산

- 자체 엔진: `frontend/src/components/custom-editor/{geometry,measure,layoutEngine,model,pmConvert}.ts`
- 수집: `frontend/src/lib/export/collectChapters.ts`
- 다이얼로그: `frontend/src/components/export/ExportDialog.tsx`
- 인쇄 PoC(참고): `frontend/src/app/(poc)/poc/export-print/page.tsx`
- HWPX 스파이크: `docs/poc/2026-06-14-hwpx-spike.md` + `backend/src/test/kotlin/com/writenote/spike/HwpxSpikeTest.kt`
- 이전 설계(계승·일부 무효): `docs/superpowers/specs/2026-06-14-export-design.ko.md`
- 핸드오프: `docs/handoff/2026-06-16-r7-export-kickoff.md`
