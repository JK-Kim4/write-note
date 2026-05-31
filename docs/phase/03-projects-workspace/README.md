# Phase 3: Projects Workspace

## 목표

사용자가 프로젝트를 만들고, 선택하고, writing studio로 진입할 수 있게 한다.

## 범위

- Projects 화면 구현.
- 새 프로젝트 생성 flow 구현.
- 프로젝트 목록 recent-first 표시.
- 활성 프로젝트 선택 상태 관리.
- project 생성 시 기본 document 자동 생성.
- 빈 상태와 최소 오류 상태 구현.

## 제외

- 프로젝트 상세 편집의 모든 고급 필드.
- 등장인물 관리.
- archive/delete lifecycle.
- 서버 API 연동.
- 검색.

## 작업 지침

1. 첫 실행 시 빈 상태가 자연스럽게 보여야 한다.
2. 프로젝트 생성은 제목만으로 가능하게 한다.
3. summary, tone, targetLength는 MVP에서 노출 범위를 최소화한다.
4. 프로젝트 선택 후 Write Studio로 이동하는 흐름을 먼저 완성한다.
5. 프로젝트 목록은 최근 수정순을 기본으로 한다.
6. 프로젝트 생성/선택 흐름을 테스트로 보호한다.

## 완료 기준

- 앱 첫 실행 시 빈 프로젝트 화면이 보인다.
- 프로젝트를 만들 수 있다.
- 만든 프로젝트가 목록에 나타난다.
- 프로젝트를 클릭하면 Write Studio로 진입한다.
- 앱 재시작 후 프로젝트 목록이 유지된다.

## 검증

```bash
cd desktop
pnpm test
pnpm typecheck
pnpm dev
```

수동 확인:

- 새 프로젝트 생성.
- 목록 표시 확인.
- 프로젝트 열기.
- 앱 재시작 후 목록 유지 확인.

## 권장 커밋

```bash
git commit -m "feat(desktop): add project workspace"
```
