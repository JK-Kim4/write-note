# 시리즈 단위 내보내기 설계 (033 이슈 7)

**작성일**: 2026-06-23
**상태**: 설계 승인 (구현 대기)
**맥락**: 033 시리즈 중심 재구성(R1~R4 완료) 후속. "시리즈 = 한 권의 책 / 작품 = 장" 모형의 자연스러운 귀결.

## 배경 / 목표

작품당 내보내기(기존)는 단일 작품을 독립 파일로 내보낸다. 시리즈 모형이 도입되면서, **시리즈(책) 단위로 여러 작품을 합본 한 파일로 내보내는** 흐름이 필요하다.

- **시리즈 내보내기(신규)**: 시리즈에 속한 작품들을 골라 순서를 정해 **하나의 파일로 합본**. 작품 = 장처럼 이어진다.
- **작품 내보내기(기존)**: 단일 작품 독립 내보내기 — **그대로 유지**.

## 핵심 전제 (코드 실측, 2026-06-23)

- 내보내기 계약은 이미 합본 구조다: `ExportRequest = { orderedIds: number[]; joinMode: JoinMode }`. 작품당 내보내기는 `orderedIds: [본문 1개]`로 쓰고 있다.
- `joinMode`: `page-title`(작품 제목 페이지 포함) / `body-only`(제목 없음) — 사용자가 말한 "소제목 포함 여부".
- 형식: pdf / hwpx / docx / txt / json (기존 `ExportDialog`).
- 시리즈 드릴인은 `LibraryBoard`에 이미 있다: `activeFolder`(=`?folder=<id>`), `folderCards = cards.filter(categoryId === activeFolder)`.
- 작품 카드(`ProjectCard`)에는 **본문(document) id가 없다** → 선택 작품의 본문은 기존 `getProjectDocument(projectId)`로 수집한다(작품당 1 fetch).
- **백엔드 변경 0**: `orderedIds` 합본 계약과 `getProjectDocument`가 이미 있다.

## 진입점

시리즈 드릴인 화면(`LibraryBoard`, `activeFolder != null`) 상단에 **"내보내기" 버튼**. 클릭 → `SeriesExportDialog`.

(작품당 내보내기 진입점 = 집필실의 기존 "내보내기"는 변경 없음.)

## 컴포넌트 구조

### `SeriesExportDialog` (신규)

- 입력 prop: 시리즈 작품 목록(`folderCards: ProjectCard[]`) + 시리즈 판형(effective) + export 핸들러.
- UI:
  - **작품 선택**: 작품별 체크박스(기본 전체 선택).
  - **순서 조절**: 선택 작품을 위/아래(↑↓) 버튼으로 재정렬(v1 — 키보드·접근성·테스트 단순. @dnd-kit 드래그는 후속 dogfooding 후 여력 시 교체). 기본 순서 = 시리즈 내 작품 표시 순서.
  - **소제목 포함**: `joinMode`(`page-title` / `body-only`).
  - **형식**: `format`(pdf/hwpx/docx/txt/json) — 기존 `ExportDialog`와 동일.
- 동작: 선택·정렬된 작품 → 각 `getProjectDocument(projectId)`로 본문 수집 → `orderedIds = [본문 id, 순서대로]` → 기존 export 핸들러 호출 → 합본 1파일.

### `ExportDialog` (기존, 작품당 단일)

- 변경 없음. `orderedIds: [document.id]`(1개) 유지.

### 공통화

- format 버튼·joinMode 선택·export 트리거 UI는 두 다이얼로그가 공유한다. 공용 컴포넌트(예: `ExportFormatOptions`)로 추출하거나, 중복이 적으면 각자 보유 — **plan에서 결정**(중복 규모 보고).

## 데이터 흐름

```
시리즈 드릴인(activeFolder) → "내보내기" 버튼
  → SeriesExportDialog(folderCards)
    → 작품 선택(체크박스) + 순서(드래그) + joinMode + format
    → [선택·정렬 작품] 각각 getProjectDocument(projectId) → 본문 수집
    → orderedIds = 본문 id 배열(정렬 순)
    → usePdfExport / useWordExport / useTextExport (orderedIds, joinMode)
  → 합본 1파일 다운로드
```

## 가장 불확실한 지점 (plan 1단계 우선 검증)

기존 export 핸들러(`usePdfExport`/`useWordExport`/`useTextExport`)가 **`orderedIds`에 본문이 여러 개일 때 실제로 합본 렌더**하는지. 계약은 다중을 지원하나 지금까지 `[1개]`로만 사용해 왔다. plan 1단계에서:

1. 핸들러가 `orderedIds` 다중 본문을 순회·합본하는지 코드로 확인.
2. 안 되면(단일 가정이면) 다중 본문 합본을 지원하도록 확장 — 이때 PDF(FE 렌더)·Word(BE `DocxExportService` chapters 배열)·text 각각의 합본 경로를 점검.

이 검증 결과가 구현 분량을 가른다(핸들러가 이미 다중 지원이면 거의 UI만, 아니면 합본 경로 확장 포함).

## 비범위 (YAGNI)

- 작품별 개별 파일 + zip 묶음(사용자가 합본 택함).
- 시리즈 메타(표지·목차 자동 생성) — v1 제외. 작품 제목 페이지(`joinMode`)로 충분.
- 작품당 내보내기 UX 변경.

## 테스트 / 검증

- 단위: 작품 선택·순서 → `orderedIds` 조립 로직(순수 함수).
- 다중 합본 렌더는 dogfooding 게이트(생성물 검증 한계 §14 — 실제 PDF/DOCX 뷰어 정합은 dogfooding).
- 무손실: 선택 작품 본문이 합본에 누락 없이 순서대로 포함.
