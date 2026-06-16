# 자체 에디터 R4 — B형 전면 교체

- 상위 설계: `docs/superpowers/specs/2026-06-16-custom-editor-full-replacement-design.md`
- 선행: R3(블록 패리티 + 소프트 줄바꿈 + 리치 복붙) 완료 — B 툴바 입력 노드 전부 무손실
- 아키텍처/plan: R3 상속(신규 엔진 로직 0, 백엔드 0). 본 라운드는 **결선·라우팅 교체**.
- 브랜치: `023-export`

## 개요

기본 B형 집필 라우트 `/b/works/[id]` 의 에디터를 TipTap(`BChapterEditor`) → 자체 엔진(`BCustomChapterEditor`)으로 **전면 교체**한다. 현재 자체 엔진은 실험 라우트 `/b/works/[id]/custom` 에만 있다. R3 으로 B 툴바가 만들 수 있는 모든 노드(문단·제목·마크4·인용·목록·구분선·소프트줄바꿈)가 무손실 지원되므로, 기존 B 챕터를 자체 엔진으로 열어도 손실이 없다.

기본 라우트는 현재 monolithic(TipTap + export). 이를 `BStudioShell + BCustomChapterEditor` 구조로 재작성하고, export(023 Round 3 진입점)를 `BStudioShell` 에 통합한다. 실험 라우트 `/custom` 과 경고 배너는 제거한다.

## 사용자 스토리

### US1 — 기본 B 라우트가 자체 엔진 (P1, 핵심)

작가로서, `/b/works/[id]` 로 들어가면 (실험 라우트가 아니라) 기본 화면에서 자체 엔진으로 글을 쓰고 싶다.

**독립 테스트:** `/b/works/3537` 진입 → 자체 엔진 에디터가 뜨고, 기존 챕터 본문이 손실 없이 보이며, 챕터 목록·전환·순서·삭제·제목편집·작업종료·충돌·쪽지/인물 패널이 모두 동작.

수용 기준:
- 기본 라우트 = `BStudioShell` + `BCustomChapterEditor`(`key={currentChapterId}` 리마운트).
- 아웃라인 = `useCustomOutline`(DOM 파생).
- 기존 B 챕터(인용/목록/구분선/마크/소프트줄바꿈 포함) 무손실 로드·저장.
- 자동저장·버전토큰·충돌감지(016) 무변경 재사용.

### US2 — Export 를 셸에 통합 (P2)

작가로서, 자체 엔진 기본 화면에서도 내보내기 다이얼로그를 열 수 있어야 한다.

**독립 테스트:** 챕터 목록의 내보내기 버튼 → ExportDialog 열림(챕터 목록·용지 표시). 실제 PDF 생성은 R7(현재 placeholder).

수용 기준:
- `BStudioShell` 이 `ChapterList onExport` + `ExportDialog`(chapters·paperSize) 를 렌더. A·B 공통 셸이므로 양쪽에서 동작.
- `onExportPdf` 는 R7 까지 no-op placeholder(기존 기본 라우트 동작 보존).

### US3 — 실험 라우트·배너 제거 (P3)

작가로서, 중복된 `/custom` 실험 화면과 "실험" 경고 배너가 없어야 한다(기본이 곧 자체 엔진이므로).

**독립 테스트:** `/b/works/[id]/custom` 디렉토리 제거, 경고 배너 제거. 빌드 GREEN.

## 기능 요구사항

- **FR-001** `BStudioShell` 에 export 통합: `exportOpen` 상태 + `ChapterList onExport` + `ExportDialog`(chapters·paperSize, onExportPdf placeholder).
- **FR-002** `/b/works/[id]/page.tsx` 재작성 → `BStudioShell`(chapterUrlBase 기본 `/b/works/${id}`) + `renderEditor`=`BCustomChapterEditor` + `useCustomOutline`.
- **FR-003** `/b/works/[id]/custom/` 라우트 디렉토리 + 경고 배너 제거.
- **FR-004** 기존 라우트 테스트(`page.test.tsx`) 갱신 — `BCustomChapterEditor`/`useCustomOutline` mock 으로 교체, 챕터 목록·순서·rename·전환·복귀링크 행위 검증 유지.
- **FR-005** R4 범위 무변경 유지: `BChapterEditor`·`BEditor`·`useEditorOutline`·`@tiptap/*` 는 **삭제하지 않음**(R6 폐기 라운드 담당) — A형이 아직 사용.

## 성공 기준

- **SC-001** `/b/works/3537` 기본 진입 시 자체 엔진 + 기존 챕터 무손실 (dogfooding).
- **SC-002** 챕터 목록·전환·순서·삭제·rename·작업종료·충돌·export 다이얼로그·쪽지/인물 패널 정상.
- **SC-003** 자동 게이트: `tsc --noEmit`, vitest(custom-editor + src/app/b), `pnpm build` GREEN. `/custom` 제거 후에도 build GREEN.

## 범위 밖

- A형 교체(R5), TipTap 폐기·패키지 제거(R6), 실제 export 생성(R7).
- 신규 에디터 기능(R3 에서 완료).
