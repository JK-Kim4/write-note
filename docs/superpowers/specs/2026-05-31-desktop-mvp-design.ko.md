# 데스크탑 MVP 설계

날짜: 2026-05-31
상태: 승인된 설계 초안
범위: 현재 작업을 잠시 멈춘 WEB 트랙과 새로운 Electron 데스크탑 MVP 트랙으로 분리한다.

## 배경

현재 repository는 `frontend/`(Next.js)와 `backend/`(Spring Boot)를 중심으로 웹 우선 제품으로 진행 중이다. 기존 웹 계획은 인증, 프로젝트/등장인물 CRUD, 에디터 자동 저장, 원고지 모드, 메모 캡처, 모바일 토큰, PWA, 배포까지 포함하면서 V1 범위가 커졌다.

이제 프로젝트는 더 빠른 피드백 루프로 전환한다.

- 기존 WEB 작업은 repository에 유지하되 blocked/paused 상태로 표시한다.
- 집중된 데스크탑 MVP를 위해 새 `desktop/` 앱을 추가한다.
- 기존 웹 UI 디자인은 이식하지 않는다. 데스크탑 앱은 새로운 디자인 방향으로 시작한다.
- 실제 글쓰기 사용성을 검증하는 데 필요한 제품 핵심만 만든다.

## 결정 사항

### 제품 트랙 분리

현재 repository를 다중 트랙 workspace로 사용한다.

```text
frontend/        # 기존 WEB frontend. 개발 일시 중단.
backend/         # 기존 WEB backend. 초기 desktop MVP에서는 미사용.
desktop/         # 새 Electron desktop app.
docs/            # 계획/상태 문서.
specs/           # 기존 Spec Kit specs 및 향후 desktop specs.
```

이 방식은 큰 경로 이동을 피한다. 기존 `frontend/`와 `backend/`는 그대로 두고, `desktop/`은 현재 웹 제약을 물려받지 않은 상태에서 빠르게 진행한다.

### 저장 전략

저장은 로컬 우선으로 하되, 나중에 동기화할 수 있는 경로를 남긴다.

데스크탑 MVP는 프로젝트, 문서, 메모를 로컬에 저장한다. 저장소는 SQLite가 가장 유력하다. 첫 사용 가능 버전은 로그인, OAuth, Spring Boot, Vercel, Render, 모바일 캡처 토큰에 의존하지 않는다.

다만 데이터 모델은 나중에 웹/동기화로 옮기기 어려운 desktop-only shortcut을 피한다. 첫 버전이 단일 사용자용이더라도 로컬 레코드는 안정적인 ID, 명시적인 timestamp, 명확한 ownership 경계를 가진다.

### 기술 방향

추천 stack:

- Electron
- Vite
- React
- TypeScript
- TipTap for rich text editing
- SQLite for local storage

이 phase에서는 binary 크기보다 속도와 익숙함이 중요하므로 Tauri보다 Electron을 우선한다. 기존 Next.js 앱을 Electron으로 감싸는 방식은 추천하지 않는다. 그 방식은 웹 routing, 디자인 부채, backend coupling을 그대로 가져오기 때문이다.

### 디자인 방향

승인된 방향은 **Focus Studio**다.

첫 화면은 dashboard가 아니라 조용한 데스크탑 글쓰기 환경처럼 느껴져야 한다. 에디터가 화면의 중심이다. 프로젝트 맥락과 메모는 얇은 side panel 또는 보조 surface로 접근 가능해야 하지만, 글쓰기 canvas를 압도하면 안 된다.

디자인 함의:

- 중앙의 큰 작성 영역.
- 최소한의 persistent chrome.
- 프로젝트 선택과 캡처 affordance는 접근 가능하지만 조용하게 둔다.
- 메모/프로젝트 맥락은 필요할 때 에디터 옆에 나타난다.
- 현재 웹의 시각 언어는 피한다.
- 무거운 dashboard, 장식적 card, 과하게 채도 높은 palette는 피한다.

## MVP 범위

### 포함

첫 데스크탑 MVP에 포함한다.

1. 프로젝트 생성과 선택.
2. 최소 형태의 프로젝트 metadata.
3. 프로젝트당 하나의 primary document.
4. 일반 에디터 모드.
5. 로컬 자동 저장.
6. 빠른 메모 캡처.
7. 메모 inbox.
8. 메모를 하나의 프로젝트에 연결.
9. 작성 화면에서 연결된 프로젝트 메모 보기.

### 제외

첫 데스크탑 MVP에서 명시적으로 제외한다.

- 원고지 모드.
- 모바일 캡처.
- 인증.
- 서버 동기화.
- Kakao OAuth.
- 이메일 flow.
- PWA.
- 배포.
- 태그.
- 이유 노트.
- 등장인물 관리.
- 문서 본문 안의 메모 pin.
- 세션 노트.
- 검색.
- Export.
- AI 기능.

원고지 모드는 제품의 핵심 기능으로 유지한다. 다만 첫 MVP를 더 빨리 사용 가능하게 만들기 위해 desktop phase 2로 이동한다.

## 화면

### Projects

목적: 현재 작성 프로젝트를 선택하거나 만든다.

최소 동작:

- 프로젝트 목록을 보여준다.
- 제목과 선택적 짧은 metadata로 프로젝트를 만든다.
- 프로젝트를 열어 writing studio로 들어간다.

### Write Studio

목적: 현재 프로젝트 문서를 작성한다.

최소 동작:

- 프로젝트 제목을 보여준다.
- 중앙 에디터를 보여준다.
- 변경 사항을 로컬에 자동 저장한다.
- 앱 재시작 후에도 내용을 복원한다.
- 기본 저장 상태를 보여준다.
- 얇은 side panel에서 연결된 프로젝트 메모를 보여준다.

### Memo Inbox

목적: 캡처한 메모를 모으고, 유용한 메모를 프로젝트에 붙인다.

최소 동작:

- 모든 메모를 최신순으로 보여준다.
- 메모를 수동으로 만든다.
- 메모를 프로젝트에 연결하거나 연결 해제한다.
- 구현이 단순하면 전체 메모와 미연결 메모 사이를 필터링한다.

### Quick Capture

목적: 떠오른 생각을 최소 마찰로 캡처한다.

최소 동작:

- 앱 UI에서 연다.
- 전역 단축키는 후속 phase에서 추가할 수 있다.
- 메모 본문만 저장한다.
- 활성 프로젝트가 없으면 기본적으로 미연결 메모로 저장한다.

## 데이터 모델

초기 로컬 모델:

```text
Project
  id
  title
  summary
  tone
  targetLength
  createdAt
  updatedAt

Document
  id
  projectId
  title
  bodyJson
  plainText
  wordCount
  createdAt
  updatedAt

Memo
  id
  body
  capturedAt
  source
  linkedProjectId nullable
  createdAt
  updatedAt

AppSetting
  key
  value
```

메모:

- `Document.bodyJson`은 TipTap/ProseMirror JSON을 저장한다.
- `Document.plainText`는 향후 검색과 sync conflict preview에 사용한다.
- `Memo.linkedProjectId`는 MVP를 위해 의도적으로 단순하게 둔다. 다중 프로젝트 메모 연결은 나중에 join table로 도입할 수 있다.
- ID는 로컬 autoincrement에만 의존하지 말고, 동기화에 적합한 형식으로 생성한다.

## 성공 기준

첫 데스크탑 MVP는 다음이 가능하면 성공이다.

1. 사용자가 프로젝트를 만들 수 있다.
2. 사용자가 프로젝트를 열고 일반 에디터에서 글을 쓸 수 있다.
3. 작성 내용이 로컬에 자동 저장된다.
4. 앱을 닫고 다시 열어도 작성 내용이 복원된다.
5. 사용자가 빠르게 메모를 캡처할 수 있다.
6. 사용자가 메모를 프로젝트에 연결할 수 있다.
7. 작성 화면에서 현재 프로젝트에 연결된 메모를 볼 수 있다.
8. 웹 backend 없이도 실제 글쓰기 세션 1회를 수행할 수 있다.

## 구현 메모

첫 구현은 보수적으로 유지한다.

- `frontend/`를 `apps/web`으로 옮기기보다 작은 `desktop/` 앱을 선호한다.
- 기존 로직은 명확히 portable하고 웹 가정을 끌고 오지 않을 때만 재사용한다.
- 현재 웹 UI component는 참고 자료로만 보고, 디자인 source of truth로 삼지 않는다.
- 향후 동기화가 로컬 persistence를 대체하거나 확장할 수 있도록 data access boundary를 명확히 둔다.
- 원고지 모드는 제품 핵심 기능이지만 첫 MVP에서는 구현하지 않는다.

## 후속 확인 사항

다음 항목은 구현 계획 단계에서 결정한다.

1. Electron에서 사용할 정확한 로컬 DB library.
2. 첫 quick capture를 앱 내부 modal만으로 할지, 전역 단축키까지 포함할지.
3. `Project.summary`, `tone`, `targetLength`를 첫 UI에 모두 노출할지, 우선 저장만 해둘지.
4. desktop phase 2를 원고지 모드부터 시작할지, 더 풍부한 메모 큐레이션부터 시작할지.
