# Phase 1: Electron/Vite Desktop App Scaffold

## 목표

`desktop/` 앱이 독립적으로 설치, 실행, 빌드되는 최소 Electron shell을 만든다.

## 범위

- `desktop/` package 생성.
- Electron main/preload/renderer 기본 연결.
- Vite React TypeScript 환경 구성.
- 기본 window title과 빈 Focus Studio shell 화면 추가.
- `dev`, `build`, `typecheck`, `test` script의 최소 기준 정의.

## 제외

- 로컬 DB 구현.
- 프로젝트/문서/메모 기능 구현.
- 기존 `frontend/` 또는 `backend` 재사용 결선.
- 기존 WEB 디자인 이식.

## 작업 지침

1. `desktop/`을 독립 앱으로 생성한다.
2. Electron main process와 renderer process의 책임을 분리한다.
3. preload를 통해 필요한 API만 노출할 수 있는 구조를 만든다.
4. renderer에서 Node API에 직접 접근하지 않도록 한다.
5. 첫 화면은 Focus Studio 방향의 빈 shell만 둔다.
6. 테스트가 아직 적더라도 `pnpm test`가 실행 가능한 상태를 만든다.

## 완료 기준

- `desktop/`에서 Electron window가 뜬다.
- `frontend/` dev server나 `backend` 실행 없이 동작한다.
- renderer와 main process가 분리되어 있다.
- renderer가 Node API에 직접 접근하지 않는다.

## 검증

```bash
cd desktop
pnpm install
pnpm dev
pnpm typecheck
pnpm test
```

## 권장 커밋

```bash
git commit -m "feat(desktop): scaffold Electron app"
```
