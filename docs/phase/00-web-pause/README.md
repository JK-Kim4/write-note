# Phase 0: WEB 일시 중단 선언 + Desktop 트랙 기준선

## 목표

기존 WEB 개발이 잠시 중단되었고, 앞으로의 우선순위가 `desktop/` MVP임을 문서와 repository 상태에 명확히 남긴다.

## 범위

- `docs/plan` 또는 별도 status 문서에 WEB 개발 blocked/paused 상태를 기록한다.
- desktop MVP 설계와 phase plan을 다음 작업의 기준 문서로 연결한다.
- 기존 `frontend/`, `backend`, `specs/00x-*`는 이동/삭제/기능 수정하지 않는다.

## 제외

- `frontend/` 코드 수정.
- `backend/` 코드 수정.
- 기존 Spec Kit 산출물 재작성.
- desktop scaffold 생성.

## 작업 지침

1. 현재 active track이 desktop MVP임을 문서에 명시한다.
2. WEB 작업은 폐기된 것이 아니라 blocked/paused 상태임을 분명히 쓴다.
3. 기준 문서로 `docs/superpowers/specs/2026-05-31-desktop-mvp-design.ko.md`와 `docs/superpowers/plans/2026-05-31-desktop-mvp-phases.md`를 연결한다.
4. 변경 범위가 문서로 한정되는지 확인한다.

## 완료 기준

- repository를 처음 보는 사람이 현재 우선순위가 WEB이 아니라 desktop MVP임을 확인할 수 있다.
- 기존 WEB 작업물은 삭제/이동되지 않는다.
- 변경 파일이 문서 범위에 한정된다.

## 검증

```bash
git diff --name-only
git status --short
```

## 권장 커밋

```bash
git commit -m "docs: pause web track for desktop MVP"
```
