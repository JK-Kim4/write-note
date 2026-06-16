# 자체 에디터 R5 — A형 전면 교체

- 상위 설계: `docs/superpowers/specs/2026-06-16-custom-editor-full-replacement-design.md`
- 선행: R3(블록 패리티·소프트 줄바꿈·리치 복붙), R4(B형 전면 교체) 완료
- 아키텍처/plan: R3/R4 상속(신규 엔진 로직 0, 백엔드 0). 결선·라우팅 교체.
- 브랜치: `023-export`
- 비고: A형은 레거시 스타일 — 사용자 합의로 가벼운 검증(B형처럼 상세 dogfooding 불필요).

## 개요

A형 집필실 `/projects/[id]/write` 의 에디터를 TipTap(`ChapterEditor`/`PaperEditor`) → 자체 엔진(`BCustomChapterEditor`)으로 교체한다. B형과 동일한 검증된 세션 결선(useDocumentSession)을 재사용한다.

## 사용자 스토리

### US1 — A형이 자체 엔진 (P1)

작가로서, A형(기본 디자인 `design:"default"`) 집필실에서도 자체 엔진으로 글을 쓰고 싶다.

수용 기준:
- `/projects/[id]/write` 에디터 = `BCustomChapterEditor`(`key={currentChapterId}` 리마운트).
- 아웃라인 = `useCustomOutline`(DOM 파생). TipTap `useEditorOutline`·`onEditorReady` 제거.
- 충돌(409): `BCustomChapterEditor` 가 `onConflict` 로 올린 핸들러로 `ConflictDialog`(기존 A형 컴포넌트) 렌더.
- 저장 상태 라벨(savestate)·작업 종료·챕터 관리(ChapterList)·메모/인물 패널·export 다이얼로그 유지.
- 자동저장·버전토큰·충돌감지(016) 무변경 재사용.

### US2 — 레거시 컨트롤 정리 (P2)

작가로서, 자체 엔진에 안 맞는 상단 컨트롤이 없어야 한다.

수용 기준:
- 줄노트(괘선)·페이지 줌 컨트롤은 자체 엔진 내장 기능으로 이관 → A형 Titlebar 상단에서 제거.
- 본문 상단 인라인 챕터 제목편집은 제거(B형과 동일, 좌측 ChapterList rename 유지).

## 기능 요구사항

- **FR-001** `/projects/[id]/write/page.tsx`: `ChapterEditor` → `BCustomChapterEditor` + `useCustomOutline` + `ConflictDialog`(onConflict). `editor` state·`onEditorReady`·`useEditorOutline`·`lined`·`zoom` 제거.
- **FR-002** 작품 미존재(404) 분기 추가(로딩→미존재→챕터빈) — R4 BStudioShell 정합.
- **FR-003** page.test 갱신: `PaperEditor` mock → `BCustomChapterEditor`/`useCustomOutline` mock. paper-editor 내부 의존 테스트(거짓409 딥테스트·본문상단 제목편집)는 제거 — 공유 `BCustomChapterEditor`(B 라우트 dogfooding)가 동일 세션 로직 커버. 챕터 삭제·되돌리기·순서·전환·rename·draft격리 테스트 유지.
- **FR-004** R5 무변경 유지: `@tiptap/*`·`ChapterEditor`·`PaperEditor`·`Editor`·`useEditorOutline` 삭제 안 함(R6 폐기 담당).

## 성공 기준

- **SC-001** `/projects/[id]/write` 자체 엔진 + 기존 챕터 무손실 (가벼운 dogfooding).
- **SC-002** 챕터 관리·충돌·작업종료·export·패널 정상.
- **SC-003** 자동 게이트: tsc·vitest(custom-editor+src/app/b+src/app/projects/[id]/write)·build GREEN.

## 범위 밖

- TipTap 폐기·패키지 제거(R6), 실제 export 생성(R7).
- 줄노트(괘선) 자체 엔진 구현(현재 미지원 — 별도 후속).
