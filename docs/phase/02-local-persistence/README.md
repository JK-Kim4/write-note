# Phase 2: Local Data Boundary + Persistence Spike

## 목표

desktop MVP의 로컬 데이터 저장 경계를 확정하고, `Project`, `Document`, `Memo`를 저장/조회할 수 있는 최소 persistence layer를 만든다.

## 범위

- 로컬 DB library = `node:sqlite`(Node 24 내장 `DatabaseSync`) 확정 — 2026-06-03 결정(설계 SoT 의 better-sqlite3 변경: 네이티브 모듈 ABI 충돌·`@electron/rebuild` Node 요구 회피).
- `Project`, `Document`, `Memo`, `AppSetting` schema 생성.
- sync-friendly ID 생성 방식 확정.
- main process에 DB 접근 모듈 배치.
- renderer는 IPC 또는 명시적 bridge API로만 데이터 요청.
- persistence layer 단위 테스트 추가.

## 제외

- 서버 동기화.
- 인증/사용자 계정.
- migration UI.
- 검색 최적화.
- 다중 프로젝트 메모 연결 join table.

## 작업 지침

1. DB library 선택 이유를 짧게 문서나 코드 주석으로 남긴다.
2. 로컬 DB 접근은 main process 쪽 경계에 둔다.
3. renderer에는 DB client를 직접 노출하지 않는다.
4. project 생성 시 기본 document가 함께 생기도록 한다.
5. ID는 나중에 sync가 가능한 형식으로 생성한다.
6. 저장/조회 테스트를 먼저 작성하고 최소 구현으로 통과시킨다.

## 완료 기준

- project 생성 시 document가 함께 생성된다.
- memo 생성/조회가 로컬 저장소에서 동작한다.
- 앱 재시작 후에도 저장된 데이터가 남는다.
- renderer가 DB 파일 또는 Node DB client에 직접 접근하지 않는다.

## 검증

```bash
cd desktop
pnpm test
pnpm typecheck
```

수동 확인:

- 앱 실행.
- project 1개 생성.
- 앱 종료 후 재실행.
- project가 유지되는지 확인.

## 권장 커밋

```bash
git commit -m "feat(desktop): add local persistence"
```
