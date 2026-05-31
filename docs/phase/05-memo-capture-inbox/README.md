# Phase 5: Quick Memo Capture + Inbox

## 목표

사용자가 떠오른 메모를 빠르게 캡처하고, inbox에서 확인할 수 있게 한다.

## 범위

- 앱 내부 quick capture modal 또는 panel 구현.
- active project가 있으면 memo의 기본 연결 project로 기록.
- active project가 없으면 unlinked memo로 저장.
- Memo Inbox 화면 구현.
- 전체 memo와 unlinked memo를 볼 수 있는 최소 필터 구현.
- memo 삭제 또는 숨김 정책 결정.

## 제외

- 모바일 캡처.
- 전역 단축키 필수 구현.
- 태그.
- 이유 노트.
- 메모 검색.
- 다중 프로젝트 연결.

## 작업 지침

1. 메모 캡처는 body만 입력하면 저장되게 한다.
2. active project가 있는 상태에서 캡처하면 project 연결을 기본값으로 둔다.
3. active project가 없으면 미연결 memo로 남긴다.
4. inbox는 최신순으로 단순하게 보여준다.
5. 삭제 정책은 복잡하게 만들지 말고, MVP에 필요한 최소 동작만 고른다.
6. 캡처 후 입력창이 비워지고 사용자가 계속 작업할 수 있어야 한다.

## 완료 기준

- 앱 UI에서 quick capture를 열 수 있다.
- body만 입력하고 memo를 저장할 수 있다.
- 저장된 memo가 inbox에 최신순으로 보인다.
- active project에서 캡처한 memo는 해당 project에 연결된다.
- active project 없이 캡처한 memo는 미연결 상태로 남는다.

## 검증

```bash
cd desktop
pnpm test
pnpm typecheck
pnpm dev
```

수동 확인:

- project 없이 memo 캡처.
- inbox에서 미연결 memo 확인.
- project를 연 상태에서 memo 캡처.
- inbox에서 project 연결 상태 확인.

## 권장 커밋

```bash
git commit -m "feat(desktop): add memo capture inbox"
```
