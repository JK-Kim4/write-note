# Phase 4: Write Studio + General Editor Autosave

## 목표

프로젝트 문서를 일반 에디터에서 작성하고, 로컬 자동 저장으로 복원할 수 있게 한다.

## 범위

- Focus Studio 레이아웃의 Write Studio 구현.
- TipTap 일반 에디터 연결.
- document body를 TipTap/ProseMirror JSON으로 저장.
- plain text와 word count 계산/저장.
- debounce 기반 로컬 autosave 구현.
- 저장 상태 표시 구현.

## 제외

- 원고지 모드.
- 메모 pin.
- 세션 노트.
- 충돌 해결 UI.
- 서버 저장.
- export.

## 작업 지침

1. 중앙 에디터가 화면의 중심이 되게 한다.
2. autosave는 사용자 입력을 방해하지 않아야 한다.
3. 저장 상태는 작고 조용하게 표시한다.
4. TipTap JSON과 plain text를 함께 저장한다.
5. 앱 종료/재실행 후 복원을 수동으로 반드시 확인한다.
6. 한국어 입력이 깨지는지 간단한 수동 확인을 포함한다.

## 완료 기준

- 프로젝트를 열면 중앙 에디터가 보인다.
- 본문을 입력할 수 있다.
- 입력 후 자동 저장 상태가 갱신된다.
- 앱을 종료하고 다시 열면 마지막 본문이 복원된다.
- plain text와 word count가 저장된다.

## 검증

```bash
cd desktop
pnpm test
pnpm typecheck
pnpm dev
```

수동 확인:

- 프로젝트 생성.
- 본문 입력.
- 저장 상태 확인.
- 앱 종료.
- 앱 재실행.
- 본문 복원 확인.

## 권장 커밋

```bash
git commit -m "feat(desktop): add editor autosave"
```
