# Data Model: 출판 방식 선택 기반 에디터 레이아웃

**Feature**: 031-publish-layout-modes | **Date**: 2026-06-21

## 엔티티 변경

### Project (`projects` 테이블)

기존 필드(id, userId, title, genre, targetLength, toneNotes, synopsis, worldNotes, nextScene, **paperSize**, archivedAt, createdAt, updatedAt)에 1개 추가.

| 필드 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `layoutMode` (DB `layout_mode`) | String | NOT NULL, DEFAULT `'paper'`, CHECK in (`paper`,`web`) | 출판 방식. `paper`=종이 출판(페이지 분할+판형), `web`=웹 출판(연속+글자수) |
| `paperSize` (기존, DB `paper_size`) | String | NOT NULL, DEFAULT `'A4'`, CHECK 8종(아래) | 종이 크기/판형. `layoutMode='paper'`일 때만 의미 |

**paperSize 허용값(8종, V18 후)**: `A4`, `A3`, `A2`, `B4`(기존 ISO) + `sinkukpan`, `kukpan`, `pan46`, `mungopan`(신규 판형, ASCII 식별자).

**상태 전이**: `layoutMode` 는 `paper ↔ web` 양방향 자유. 전이 시 본문(챕터 bodyJson)·paperSize 값 불변(무손실). web→paper 전환 시 기존 paperSize 값(기본 A4 또는 마지막 선택)으로 페이지 분할 재개.

**검증 규칙**:
- `layoutMode` ∉ {paper, web} → ValidationException (BE), null → 'paper' 기본.
- `paperSize` ∉ 8종 → ValidationException, null → 'A4' 기본.
- 생성 시 `layoutMode` 강제 선택은 **프론트 UX 계층**에서 보장(BE 는 관대 — null→paper).

## 판형 프리셋 (frontend `geometry.ts`)

`PAPER_MM` 확장 + 판형별 조판 프리셋. 폰트·행간 공통, 크기·여백 판형별.

| 식별자 | 라벨 | widthMm | heightMm | 본문 폰트 | 행간 | 분량 근사 |
|---|---|---|---|---|---|---|
| `sinkukpan` | 신국판 | 152 | 225 | ~10pt(공통) | 1.8(공통) | **앵커**: 원고지 ≈3.5매/면 |
| `kukpan` | 국판 | 148 | 210 | ~10pt | 1.8 | 면적비 근사 |
| `pan46` | 46판 | 128 | 188 | ~10pt | 1.8 | 면적비 근사 |
| `mungopan` | 문고판 | 105 | 148 | ~10pt | 1.8 | 면적비 근사 |
| (기존) A4/A3/A2/B4 | ISO | 210/297/420/257 | 297/420/594/364 | 현행 | 현행 | — |

- **여백**: v1 은 판형별 단순 여백(현재 `MARGIN_MM=25` 고정을 프리셋 값으로). 안쪽 +3~5mm 는 후속 정밀화 여지.
- **신국판 앵커 검증**: 폰트·여백 보정 후 신국판 1면 글자수가 700~800자(원고지 3.3~3.7매) 범위에 드는지 측정(SC-002).
- **geometry.ts vs pageLayout.ts**: 집필실은 geometry.ts 기준이므로 판형 4종은 geometry.ts 의 `PaperSize` 타입·`PAPER_MM`·`PAPER_SIZES`에 추가. 레거시 pageLayout.ts 는 미접촉(작품관리 표시용 ISO 4종 유지 가능).

## 분량 지표 모델

| 모드 | 지표 | 산출 |
|---|---|---|
| `paper` | 페이지 수 + 200자 원고지 환산 매수 | `view.pages.length` + 글자수/200 |
| `web` | 글자수(공백 제외 우선, 공백 포함 보조) | 신규 `charCount.ts`(model.buffer 기반) |

## 변경 파일 체크리스트 (검증 지점 누락 방지)

### 백엔드 (layoutMode 추가)
- [ ] `entity/Project.kt` — `var layoutMode: String = "paper"`
- [ ] `model/request/CreateProjectRequest.kt` — `layoutMode: String? = null`
- [ ] `model/request/UpdateProjectRequest.kt` — `layoutMode: String? = null`
- [ ] `model/response/ProjectResponse.kt` — `layoutMode: String`
- [ ] `mapper/ProjectMapper.kt` — `layoutMode = project.layoutMode`
- [ ] `service/ProjectService.kt` — `validatedLayoutMode()` + `ALLOWED_LAYOUT_MODES` + create/update 반영
- [ ] `db/migration/V17__add_projects_layout_mode.sql`

### 백엔드 (paperSize 8종 확장)
- [ ] `service/ProjectService.kt:207` — `ALLOWED_PAPER_SIZES` 8종
- [ ] `service/SettingsService.kt:59` — `ALLOWED["paperSize"]` 8종
- [ ] `db/migration/V18__extend_projects_paper_size.sql` — CHECK 제약 교체(DROP+ADD)

### 프론트 (layoutMode)
- [ ] `lib/api/projects.ts` — Create/Update Input + `layoutMode`
- [ ] `types/api.ts` — ProjectResponse + `layoutMode`
- [ ] `app/(main)/library/page.tsx` — 생성/수정 폼 강제 선택 + handleCreate/fromProject
- [ ] `components/b/BStudioShell.tsx` — 모드별 UI 분기(판형 select 는 paper 만) + 전환

### 프론트 (paperSize 8종)
- [ ] `components/custom-editor/geometry.ts` — PaperSize 타입 + PAPER_MM + PAPER_SIZES + 판형 프리셋
- [ ] `app/(main)/library/page.tsx:208` — select 옵션 8종
- [ ] `components/b/BStudioShell.tsx:342` — select 옵션 8종
- [ ] `app/(main)/settings/page.tsx:30` — PAPER_SIZE_OPTIONS 8종(전역 기본, 선택적)

### 프론트 (렌더/지표)
- [ ] `components/custom-editor/layoutEngine.ts` — 연속(미분할) 분기
- [ ] `components/custom-editor/printLayout.tsx` — relayout 모드 전달
- [ ] `components/custom-editor/CustomEditor.tsx` — 웹 연속 렌더 분기 + 좌표계 어댑터
- [ ] `components/custom-editor/charCount.ts` — 신규 글자수 헬퍼

### 테스트
- [ ] `ProjectControllerIT.kt` — layoutMode create/update/검증
- [ ] `charCount.test.ts`, 판형 프리셋 분량 계산 테스트(순수 함수 TDD)
