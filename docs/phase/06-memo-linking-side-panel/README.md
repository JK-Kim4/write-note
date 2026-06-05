# Phase 6: Project Memo Linking + Studio Side Panel

## 목표

memo를 project에 연결/해제하고, 작성 화면에서 현재 project memo를 볼 수 있게 한다.

## 범위

- Inbox에서 memo의 project 연결/해제 UI 구현.
- project 목록 기반 연결 selector 구현.
- Write Studio의 얇은 side panel 구현.
- 현재 project에 연결된 memo 목록 표시.
- Focus Studio 방향에 맞는 조용한 side panel 유지.

## 제외

- 메모 pin.
- 메모 태그/이유 노트.
- drag-and-drop 고급 큐레이션.
- 모바일 큐레이션.

> **범위 변경(2026-06-05):** 당초 제외였던 "다중 프로젝트 연결"은 브레인스토밍 확정에 따라 **본 Phase 범위에 포함**된다(메모↔작품 many-to-many, 연결 테이블 `memo_projects`). 상세는 `specs/008-phase-6-memo-linking-side-panel/` + `docs/superpowers/specs/2026-06-05-desktop-phase6-memo-linking-design.ko.md`.

## 작업 지침

1. 메모 연결은 select 또는 간단한 메뉴로 충분하다.
2. 연결 해제 동작을 반드시 제공한다.
3. Write Studio side panel은 글쓰기 canvas보다 시각적으로 약해야 한다.
4. 현재 project에 연결된 memo만 표시한다.
5. memo 목록이 비어 있을 때도 화면이 어색하지 않아야 한다.
6. memo 연결 변경 후 side panel이 즉시 갱신되어야 한다.

## 완료 기준

- 기존 unlinked memo를 특정 project에 연결할 수 있다.
- memo 연결을 해제할 수 있다.
- Write Studio에서 현재 project에 연결된 memo만 보인다.
- 메모가 많지 않은 초기 상태에서 UI가 무겁게 느껴지지 않는다.

## 검증

```bash
cd desktop
pnpm test
pnpm typecheck
pnpm dev
```

수동 확인:

- memo 2개 생성.
- 하나는 project A에 연결, 하나는 미연결로 유지.
- project A Write Studio에서 연결 memo만 표시되는지 확인.
- 연결 해제 후 side panel에서 사라지는지 확인.

## 권장 커밋

```bash
git commit -m "feat(desktop): link memos to projects"
```
