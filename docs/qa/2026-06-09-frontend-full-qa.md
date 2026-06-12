# 2026-06-09 Frontend 전체 기능 QA

## 요약

- 대상: `localhost:3000` FE, `localhost:8080` BE
- 계정/데이터: 로그인된 dogfood 세션, 기존 프로젝트 `1131`, QA용 임시 프로젝트 `1217`
- 방식: in-app browser 화면 QA, 주요 라우트 DOM 스냅샷, FE 정적 검증
- 결론: 핵심 라우트 로드, 작품 생성/삭제, 집필 저장/복귀, 작업 종료 기록 반영은 확인했다. 정적 검증은 `typecheck`, `lint`가 실패한다. 좁은 폭 곁쪽지 패널, 전역 탐색 일관성, 개발 모드 Quick Capture 조작 방해 이슈가 남아 있다.

## 검증 환경

- 날짜: 2026-06-09
- FE: `http://localhost:3000`
- BE: `http://localhost:8080`
- Browser: Codex in-app browser
- 비고: Browser automation에서 `fill()` 일부가 가상 클립보드 미설치 오류를 냈고, 일부 locator는 CDP `Runtime.evaluate` 타임아웃이 발생했다. 입력 검증은 가능한 범위에서 키 입력/좌표 클릭으로 대체했다.

## 정적 검증

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| `pnpm test` | Pass | 18 files, 83 tests passed |
| `pnpm typecheck` | Fail | `src/lib/electron-api/documents.test.ts:43:73`, `version: 3` number가 string 타입과 불일치 |
| `pnpm lint` | Fail | `write/page.tsx:100`, `useDocumentSession.ts:121`, `useDocumentSession.ts:126` React hooks 규칙 위반, `useDocumentSession.ts:202` unused eslint-disable warning |

## 라우트 스윕

| 라우트 | 결과 | 확인 신호 |
| --- | --- | --- |
| `/` | Pass | Rail, 작품 목록, `이어 쓸 작품`, `새 작품` |
| `/projects/1131/write` | Pass | Rail, 집필 titlebar, 저장 상태, 본문 편집기 |
| `/memos` | Pass | Rail, `책상 위 쪽지`, 메모 목록, 작품 필터 |
| `/logs` | Pass | Rail, 기록 카드 목록 |
| `/contact` | Pass | Rail, 문의 폼, 카카오 문의 버튼 |
| `/settings` | Partial | 설정 내용 로드됨. Rail 없음 |
| `/projects/1131` | Partial | 프로젝트 상세 로드됨. Rail 없음 |
| `/projects/1131/edit` | Partial | 편집 폼 로드됨. Rail 없음 |
| `/projects/1131/characters` | Partial | 등장인물 폼 로드됨. Rail 없음 |

## 기능 흐름 QA

### 통과

- 작품 생성: `QA-FE-1781011897477` 생성 후 `/projects/1217/write` 이동 확인.
- 집필 저장/복귀: `qafeBody1781011937671` 입력 후 `메모` 이동, `집필` 복귀 시 본문 유지. 복구 알림 없음.
- 작업 종료: `qafeLog1781011937671` 기록 저장 후 작품 목록으로 이동.
- 기록 반영: `/logs`에서 QA 프로젝트와 작업 종료 기록 표시 확인.
- 작품 삭제: QA 프로젝트 삭제 확인 모달 표시, 삭제 확정 후 목록에서 제거됨.
- 데스크톱 폭 곁쪽지: 1280px 폭에서 좌표 클릭 시 `연결된 메모` 패널 표시 확인.

### 미검증/제약

- 빠른 메모 저장: 개발 모드에서 하단 Next.js Dev Tools 오버레이가 빠른 메모 영역 클릭을 가로막았고, 이후 locator가 CDP 타임아웃을 냈다.
- `/memos` 인라인 메모 추가: `fill()`은 가상 클립보드 미설치 오류, 키 입력 locator는 CDP 타임아웃으로 완료하지 못했다.
- 등장인물 추가/삭제: 화면 로드는 확인했지만 입력 조작은 동일한 브라우저 자동화 제한으로 완료하지 못했다. 단, Vitest에는 등장인물 추가/중복/정렬 테스트가 포함되어 있고 이번 실행에서 통과했다.
- 한글 IME 즉시 이동: 이번 자동화는 영문/ASCII keypress 중심이다. 사용자가 직접 재현한 한글 IME 조합 입력 직후 이동 조건은 별도 수동 QA가 필요하다. 현재 `PaperEditor`는 조합 중 draft 즉시 기록과 unmount flush를 갖고 있어 개선 코드는 들어가 있다.

## 발견 이슈

### P1. FE `typecheck` 실패

- 재현: `cd frontend && pnpm typecheck`
- 결과: `src/lib/electron-api/documents.test.ts:43:73`에서 `version: 3`이 string 타입과 맞지 않아 실패.
- 영향: 타입 검증 기반 CI/배포 게이트가 막힌다.
- 코드 근거: `frontend/src/lib/electron-api/documents.test.ts:43`

### P1. FE `lint` 실패

- 재현: `cd frontend && pnpm lint`
- 결과:
  - `frontend/src/app/projects/[id]/write/page.tsx:100` `react-hooks/set-state-in-effect`
  - `frontend/src/hooks/useDocumentSession.ts:121` `react-hooks/set-state-in-effect`
  - `frontend/src/hooks/useDocumentSession.ts:126` `react-hooks/refs`
  - `frontend/src/hooks/useDocumentSession.ts:202` unused eslint-disable warning
- 영향: lint 기반 CI/배포 게이트가 막힌다. 자동저장 개선 코드가 React 19 hooks lint 규칙과 충돌한다.

### P1. 좁은 폭에서 곁쪽지 서랍을 눌러도 패널을 볼 수 없음

- 재현 관찰: 집필 화면에서 곁쪽지 버튼이 `[pressed]` 상태가 되었지만 DOM에 `연결된 메모` 패널이 없었다.
- 코드 근거: `frontend/src/styles/desktop-app.css:506-508`
- 원인 후보: `@media (max-width: 880px)`에서 `.side-panel { display: none; }`로 고정되어 버튼 상태와 실제 표시가 분리된다.
- 영향: 작은 브라우저 폭, 좁은 Electron 창, 일부 모바일/태블릿 폭에서 사용자가 패널을 열었다고 인지하지만 내용을 볼 수 없다.

### P2. 설정/상세/편집/등장인물 화면에서 전역 Rail이 사라짐

- 재현: `/settings`, `/projects/1131`, `/projects/1131/edit`, `/projects/1131/characters`
- 결과: 화면 내용은 로드되지만 `작품/집필/메모/기록/문의/빠른 메모` Rail이 없다.
- 코드 근거:
  - `frontend/src/app/settings/page.tsx:8`, `frontend/src/app/settings/page.tsx:28`
  - `frontend/src/app/projects/[id]/page.tsx:79-81`
  - `frontend/src/app/projects/[id]/characters/page.tsx:101-105`
- 영향: 작업실 주요 화면과 탐색 체계가 끊긴다. 특히 설정에서 다시 집필/메모로 돌아가려면 브라우저 뒤로가기 또는 직접 URL 이동에 의존한다.
- 비고: 의도된 분리 설계일 가능성은 있으나, 제품 목적이 “한 작업실에 모든 맥락”인 점을 기준으로 UX 리스크로 분류한다.

### P2. 개발 모드 Next.js Dev Tools가 빠른 메모 버튼 조작을 방해함

- 재현 관찰: 집필 화면 하단 좌측 빠른 메모 영역을 좌표 클릭했을 때 `Next.js Dev Tools Items` 메뉴가 열렸다.
- 코드 근거: 앱 Rail의 빠른 메모 버튼은 `frontend/src/components/workspace/Rail.tsx:101-109`에 있으며, 개발 모드 오버레이가 같은 하단 좌측 영역에 떠 있다.
- 영향: 개발/QA 환경에서 빠른 메모 기능 검증과 사용이 방해된다.
- 비고: 운영 빌드에는 Next Dev Tools가 없으므로 릴리즈 사용자 영향은 낮다.

## 후속 권장 순서

1. `typecheck`와 `lint` 실패를 먼저 정리해 CI 게이트를 복구한다.
2. 곁쪽지 서랍의 좁은 폭 동작을 결정한다: 버튼 숨김, 하단/오버레이 패널, 별도 drawer 중 하나로 일관화.
3. Rail 없는 화면의 탐색 정책을 확정한다. 의도된 상세 설정 영역이면 최소한 “작업실로 돌아가기” 동선을 명시한다.
4. 한글 IME 즉시 이동은 실제 수동 QA 체크리스트로 다시 검증한다.
