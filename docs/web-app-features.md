# write-note 웹 애플리케이션 — 제공 기능 정리

> **문서 목적**: 현재 코드베이스(`frontend/`) 기준으로 웹 애플리케이션이 사용자에게 제공하는 기능을 정리한다.
> **기준 브랜치**: `015-web-port-frontend` · **작성일**: 2026-06-08
> **출처**: `frontend/src/app/`(라우트) · `frontend/src/components/`(기능 컴포넌트) · `frontend/src/lib/api/`(API 레이어) 직접 분석.

write-note 는 **작가용 통합 작업공간**이다. 한 곳에서 **본문 집필 + 곁쪽지(메모) 캡처·정리 + 등장인물 관리**를 하고, 세션이 끊겨도 컨텍스트(메모·진행·다음 장면)가 이어지도록 만드는 것이 핵심이다.

---

## 한눈에 보기

| 영역 | 사용자가 할 수 있는 일 | 상태 |
|---|---|---|
| **회원/인증** | 이메일 가입·인증, 카카오 로그인/연결, 비밀번호 재설정, 로그인 잠금 | 구현 |
| **작품 관리** | 작품 생성·수정·보관·삭제, 메타(장르·목표·톤·시놉시스·세계관) 관리, "다음 장면" 한 줄 | 구현 |
| **본문 집필** | TipTap 에디터 / 원고지 모드, 자동저장, 버전 충돌 감지, 글자수·진행률 | 구현 |
| **등장인물** | 추가·수정·삭제, 드래그 재정렬 | 구현 |
| **곁쪽지(메모)** | 빠른 캡처, 메모 책상(전역), 메모 서랍(작품별), 작품 연결·고정 | 구현 |
| **설정** | 작성 모드/원고지 크기/테마, 계정 정보, 모바일 캡처 API 토큰 | 구현 |
| **기록(로그)·문의** | 네비게이션 항목만 존재 (`/logs`, `/contact`) | **미구현** |

> ⚠️ **미구현 주의**: 좌측 Rail 네비게이션에 "기록"(`/logs`)·"문의"(`/contact`) 버튼이 있으나 해당 페이지(`page.tsx`)는 아직 존재하지 않는다. 도메인 타입(`ProjectLog`, `WorkSession`, `LogCard`)은 정의돼 있어 백엔드/타입 기반은 준비됐으나 화면은 미작성 상태다.

---

## 1. 회원 / 인증

이메일 또는 카카오로 가입·로그인할 수 있고, 인증 메일 기반 본인 확인과 비밀번호 재설정을 지원한다.

**제공 기능**
- 이메일 회원가입 — 가입 후 **이메일 인증 필수**(인증 링크 검증 → 완료 화면)
- 카카오 OAuth 로그인
- 카카오 계정 추가 연결(이미 가입한 계정에 카카오 연결, 설정 화면에서)
- 비밀번호 재설정 — 이메일 링크 기반(요청 → 메일 발송 → 새 비밀번호 설정 → 완료)
- 로그인 잠금 — 로그인 반복 실패 시 차단(재시도 횟수 표시)
- 로그아웃
- 세션 유지 — httpOnly 쿠키, 401 발생 시 자동 토큰 refresh 후 재시도

**관련 화면 (`/auth/*`)**
- `login` · `login-error` · `login-loading` — 로그인 / 실패 / 로딩
- `signup` · `signup-email` · `signup-error` — 가입 방식 선택 / 이메일 가입 / 가입 실패
- `verify` · `verify-pending` · `verify-done` — 이메일 인증 검증 / 재발송 안내 / 완료
- `reset-request` · `reset-sent` · `reset-new` · `reset-done` — 재설정 요청 / 발송 / 새 비밀번호 / 완료
- `link-success` — 카카오 추가 연결 완료

---

## 2. 작품(프로젝트) 관리

작가의 각 작품을 카드로 관리하고, 작품별 메타 정보를 다룬다.

**제공 기능**
- **작품 벽(홈, `/`)** — 모든 작품을 카드 목록으로. 카드마다 마지막 문장·목표 분량·"다음 장면" 표시
- 새 작품 생성(`/projects/new`) — 제목(필수) + 장르·목표 분량·톤·시놉시스·세계관(선택)
- 작품 상세(`/projects/[id]`) — 메타 카드 + 편집/보관·해제/삭제/등장인물 진입 버튼
- 작품 메타 편집(`/projects/[id]/edit`) — 제목·장르·목표 분량·톤·시놉시스·세계관·**"다음에 쓸 장면"** 수정
- "다음 장면" 한 줄 저장 — 작품 카드에서 직접 입력(다음 집필 진입점 메모)
- 작품 보관 / 보관 해제
- 작품 영구 삭제

---

## 3. 본문 집필

작품마다 본문 문서를 편집한다. 두 가지 작성 모드를 지원한다.

**제공 기능**
- **에디터 모드** — TipTap(ProseMirror) WYSIWYG. 굵게·기울임·제목·리스트·인용 등 서식
- **원고지 모드** — 한글 고정폭 입력, 200/400/1000자 격자 선택, 매수 자동 계산
- **자동저장** — 본문 변경 후 디바운스 저장(약 3초)
- **버전 충돌 감지** — 다른 곳에서 수정된 경우 충돌 다이얼로그(재로드 vs 덮어쓰기 선택)
- **글자수 실시간 표시** + 목표 분량 진행률(원형 게이지)
- 본문 미리보기 모드(`/write/preview`)

**관련 화면**
- `/projects/[id]/write` — 작품별 집필실(본문 에디터 + 메모 서랍 + 자동저장)
- `/write` — 작품 미지정 범용 에디터
- `(poc)/poc/write` — 원고지 모드 개발용 테스트 화면(PoC, 일반 사용자 대상 아님)

---

## 4. 등장인물 관리

작품별 등장인물을 정리한다.

**제공 기능 (`/projects/[id]/characters`)**
- 등장인물 추가 — 이름(필수) + 짧은 설명 + 상세 노트
- 등장인물 정보 수정
- 등장인물 삭제
- 드래그 앤 드롭으로 표시 순서 재정렬

---

## 5. 곁쪽지(메모)

집필 중 떠오른 생각을 최소 마찰로 캡처하고, 작품과 연결해 정리하는 핵심 컨텍스트 기능이다.

**제공 기능**
- **빠른 캡처(잉크 버튼)** — 화면 어디서든 Rail 하단 "잉크 한 방울" 버튼으로 모달 캡처. 활성 작품이 있으면 자동 연결, 없으면 미연결. 초안 자동 보존(Escape/바깥 클릭 시 초안 있으면 닫기 방지)
- **메모 책상(`/memos`)** — 캡처된 전역 메모 목록
  - 작품별 필터링(추림)
  - 메모 인라인 추가
  - 메모를 여러 작품에 연결/해제(LinkPopover 체크리스트)
- **메모 서랍(집필실 내 MemoPanel)** — 현재 작품에 연결된 메모
  - 메모 고정(작품당 1개) — 재진입 시 고정한 한 장이 떠오름
  - 빠른 연결 해제
- 메모 큐레이션 — 작품 연결·태그·사유 메모 저장

---

## 6. 설정

**제공 기능 (`/settings`)**
- 작성 모드 선택 — 에디터 vs 원고지
- 원고지 크기 — 200 / 400 / 1000자
- 테마 — 라이트 / 다크
- 계정 정보 — 이메일, 카카오 연결 상태
- 로그아웃
- **모바일 캡처 API 토큰 관리**
  - 새 토큰 발급(Bearer 토큰, 원본 1회만 노출)
  - 발급 목록 보기(prefix만 표시, 원본 숨김, 마지막 사용 시간)
  - 토큰 라벨 추가/수정
  - 토큰 해지
  - iOS Shortcut 연동 가이드(`POST /api/capture` 모바일 캡처)

---

## 부록 A. 백엔드 API 호출 목록

웹 앱이 호출하는 백엔드 기능(`frontend/src/lib/api/`). 사용자 기능과 1:1 대응한다.

| 모듈 | 주요 호출 |
|---|---|
| `auth.ts` | login · signupEmail · verifyEmail · requestPasswordReset · confirmPasswordReset · fetchMe · logout |
| `projects.ts` | listProjects · createProject · getProject · updateProject · archiveProject · unarchiveProject · deleteProject |
| `characters.ts` | listCharacters · getCharacter · createCharacter · updateCharacter · deleteCharacter · reorderCharacters |
| `document.ts` | getProjectDocument · getDocument · saveDocument(자동저장·409 충돌) · updateDocumentTitle |
| `memo.ts` | listMemos · getMemo · listProjectMemos · setProjectMemoPin · captureMemo · curateMemo · patchMemo · deleteMemo |
| `apiToken.ts` | issueToken · listTokens · updateTokenLabel · revokeToken |

**HTTP 클라이언트(`client.ts`) 공통 처리**: httpOnly 쿠키 자동 포함 · Result 응답 envelope unwrap · 401 자동 refresh 후 재시도 · 409 `DOCUMENT_VERSION_CONFLICT` 충돌 처리 · 에러 코드 → 한국어 메시지 변환.

## 부록 B. 핵심 도메인 개념 (`lib/types/domain.ts`)

| 타입 | 의미 |
|---|---|
| `Project` / `ProjectCard` | 작품 / 작품 벽 카드(+ 마지막 문장) |
| `ProjectDocument` | 본문 문서(제목, ProseMirror JSON 본문, 글자수, 버전) |
| `Memo` / `ProjectMemo` / `InboxMemo` | 곁쪽지 / 작품 맥락 메모(+ 고정) / 책상·서랍 뷰 메모 |
| `LinkedProject` | 메모에 연결된 작품 |
| `ProjectLog` / `WorkSession` / `LogCard` | 집필 기록 / 작업 세션 / 기록 카드 — **타입만 정의, 화면 미구현** |

---

## 기술 스택 (참고)

- **프레임워크**: Next.js 16 App Router + TypeScript + React 19
- **에디터**: TipTap (ProseMirror)
- **상태**: React Query(서버 상태) + Zustand(로컬 UI)
- **인증**: httpOnly 쿠키 세션 + JWT, 카카오 OAuth
- **모바일 캡처**: iOS Shortcut → `POST /api/capture` (사용자별 long-lived API 토큰)

> 이 문서는 현재 구현 상태의 스냅샷이다. "기록/문의" 등 미구현 영역은 추후 화면이 추가되면 갱신 필요.
