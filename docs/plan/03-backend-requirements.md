# write-note V1 — 백엔드 요구사항 명세서

**날짜:** 2026-05-22
**상태:** 본 grill 세션 결정 기록 — 백엔드 코드 작성 진입 직전 SoT (Source of Truth, 진실의 단일 출처)
**전 단계 산출물:** [DESIGN.md](../../DESIGN.md), [00-stack-and-schedule.md](./00-stack-and-schedule.md), [01-phase-breakdown.md](./01-phase-breakdown.md)
**다음 단계:** Phase 단위 spec (`specs/003-*` 이후) 진행 시 본 문서를 SoT 로 참조

---

## 0. 본 문서의 위치 (4계층 컨텍스트 영속 구조)

```
[1] DESIGN.md                    ← 본질 + UI/UX 결정
[2] 00-stack-and-schedule.md     ← 기술 스택 + Week 일정 + 도메인 초안
[3] 01-phase-breakdown.md        ← Week → Phase 분해
[4] 본 문서 (03-backend-requirements)  ← 백엔드 통합 SoT (도메인 확정 + API 계약 + 인증/인가)
[5] specs/{NNN}-{feature}/spec.md     ← Phase 단위 작업 spec (본 문서 참조)
```

본 문서는 *백엔드 코드 작성 직전의 통합 SoT*. Phase 단위 spec (`specs/`) 들이 본 문서를 참조하여 입출력 / 권한 / 에러 처리 결정 반복 회피.

---

## 1. 본질 + V1 범위

### 1-1. 본 명세 작성 목적 (DESIGN.md 26줄 인용)

> *"세션이 끊겨도 컨텍스트가 살아있는 작가의 외장 기억장치."*

본 백엔드는 작가의 메모/본문/메타 데이터를 *영구 보존* 하며 *재진입 시 컨텍스트* 를 즉시 복원하는 역할.

### 1-2. V1 범위 (00-stack §1 + DESIGN.md 60-110, 167-178줄)

| 항목 | 내용 |
|---|---|
| 1차 사용자 | 본인 (한국어 작가, 주말/저녁 30~90분 세션) |
| 비용 제약 | $0/월 (Vercel + Render + Supabase Postgres 무료) |
| 일정 | 6~8주 |
| dogfooding 기준 | 주 1회 이상 글쓰기 세션 시작 시 본 도구 사용 |
| 실패 신호 | V1 출시 4주 후에도 본인이 안 쓰고 있음 |

### 1-3. NOT in scope (V1)

- 모든 LLM/AI 기능
- 협업/다중 사용자
- 모바일 작성 (모바일 = 캡처 + inbox 조회만)
- Export (PDF/EPUB) — V1 복사붙여넣기로 충분
- 버전 관리/히스토리
- WebSocket 실시간 (V1 = polling + refetch on focus)

---

## 2. 도메인 모델

### 2-1. 엔티티 목록 (10 개)

| # | 엔티티 | 본질 | 관계 |
|---|---|---|---|
| 1 | Users | 사용자 정보 + 인증 메타 | 1:N → Project / Memo / ApiToken / AuthToken |
| 2 | AuthToken | 이메일 인증 / 비밀번호 재설정 / refresh 토큰 통합 보조 테이블 | N:1 → Users |
| 3 | Project | 작가의 한 작품 (단막극 / 단편 / 장편) | N:1 → Users, 1:1 → Document, 1:N → Character / SessionNote |
| 4 | Character | 작품의 등장인물 | N:1 → Project |
| 5 | Document | 작품의 본문 텍스트 | 1:1 ↔ Project |
| 6 | Memo | 작가가 캡처한 영감 한 줄 | N:1 → Users, 0:1 → Document (핀) |
| 7 | MemoProject | 메모-프로젝트 연결 (큐레이션 다대다) | M:N (Memo ↔ Project) |
| 8 | MemoProjectCharacter | 메모-프로젝트 연결의 인물 연결 (다대다 정규화) | M:N (MemoProject ↔ Character) |
| 9 | SessionNote | 세션 종료 시 "다음 세션을 위한 한 줄" + 세션 메타 | N:1 → Project |
| 10 | ApiToken | 모바일 캡처용 장기 유효 토큰 | N:1 → Users |

### 2-2. 엔티티 상세

#### Users (10 필드)

```
id              BIGSERIAL PK
email           VARCHAR NOT NULL UNIQUE
kakao_id        VARCHAR (nullable, UNIQUE if not null)
password_hash   VARCHAR (nullable, BCrypt cost 12)
email_verified_at TIMESTAMP (nullable)
last_login_at   TIMESTAMP (nullable)
failed_login_count INTEGER NOT NULL default 0
lockout_until   TIMESTAMP (nullable, 5회 실패 시 30분 잠금)
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL

제약: password_hash 또는 kakao_id 중 최소 하나는 채워져야 함 (CHECK)
정책: 한 사용자가 둘 다 연결 가능 (가입 후 추가 연결 흐름 V1 포함)
```

#### AuthToken (통합 보조 테이블)

```
id              BIGSERIAL PK
user_id         BIGINT NOT NULL FK → Users
type            VARCHAR NOT NULL ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET', 'REFRESH')
token_hash      VARCHAR NOT NULL UNIQUE (SHA-256)
expires_at      TIMESTAMP NOT NULL
used_at         TIMESTAMP (nullable, 일회용 무효 표시)
created_at      TIMESTAMP NOT NULL

만료 정책:
  - EMAIL_VERIFY: 24시간
  - PASSWORD_RESET: 30분
  - REFRESH: 30일

청소: 매일 자정 cron 으로 만료된 행 + used_at NOT NULL 인 EMAIL_VERIFY/PASSWORD_RESET 삭제
인덱스: token_hash UNIQUE, (user_id, type)
```

#### Project (11 필드)

```
id              BIGSERIAL PK
user_id         BIGINT NOT NULL FK → Users
title           VARCHAR NOT NULL
genre           VARCHAR (nullable, 자유 텍스트)
target_length   INTEGER (nullable, 자수 단위 공백 제외)
tone_notes      TEXT (nullable)
synopsis        TEXT (nullable)
world_notes     TEXT (nullable, 마크다운)
archived_at     TIMESTAMP (nullable, NULL=미보관 / 값=보관 시점)
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL

인덱스: (user_id, updated_at DESC) — 홈 최근 프로젝트
```

#### Character (8 필드)

```
id              BIGSERIAL PK
project_id      BIGINT NOT NULL FK → Project
name            VARCHAR NOT NULL
short_description VARCHAR (nullable)
notes           TEXT (nullable, 마크다운)
display_order   INTEGER NOT NULL default 0
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL

인덱스: (project_id, display_order ASC, created_at ASC)
```

#### Document (8 필드)

```
id              BIGSERIAL PK
project_id      BIGINT NOT NULL UNIQUE FK → Project (MVP 1:1 강제)
title           VARCHAR NOT NULL
body            JSONB NOT NULL (ProseMirror JSON, custom mark 'memo-pin' 포함)
word_count      INTEGER NOT NULL default 0 (자수 단위 공백 제외, 서버 자동 계산)
version         INTEGER NOT NULL default 0 (JPA @Version, optimistic lock)
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL

충돌 정책: optimistic lock + 409 Conflict + 클라이언트 경고 토스트
관계: V1 = Project ↔ Document 1:1, V1.5 후보 = 1:N (UNIQUE 제거 + 마이그레이션)
```

#### Memo (11 필드)

```
id              BIGSERIAL PK
user_id         BIGINT NOT NULL FK → Users
body            TEXT NOT NULL (plain text)
source          VARCHAR NOT NULL ENUM ('MOBILE', 'DESKTOP')
captured_at     TIMESTAMP NOT NULL (서버 도착 시각)
active_project_at_capture BIGINT (nullable, FK → Project — 데스크탑 캡처 시 활성 프로젝트)
reason_note     TEXT (nullable, 큐레이션 시점 "왜 적었나")
tags            TEXT[] NOT NULL default '{}'
pinned_document_id BIGINT (nullable, FK → Document)
created_at      TIMESTAMP NOT NULL
updated_at      TIMESTAMP NOT NULL

인덱스: (user_id, captured_at DESC), tags GIN, pinned_document_id

핀 위치 추적: pinned_document_id 컬럼 + Document.body JSONB 안 'memo-pin' custom mark
  (mark attrs = { memo_id }). ProseMirror step.mapping 으로 본문 편집 시 자동 위치 이동 +
  텍스트 삭제 시 핀 자동 사라짐. 핀 attach/detach 는 단일 트랜잭션
  (Memo.pinned_document_id 갱신 + Document.body mark 추가/제거).
```

#### MemoProject (M:N 메모-프로젝트 연결)

```
id              BIGSERIAL PK
memo_id         BIGINT NOT NULL FK → Memo
project_id      BIGINT NOT NULL FK → Project
created_at      TIMESTAMP NOT NULL

UNIQUE (memo_id, project_id)
인덱스: project_id, memo_id

미분류 정의: 한 Memo 에 MemoProject 행이 0 개 (DESIGN.md 258)
```

#### MemoProjectCharacter (M:N MemoProject ↔ Character)

```
id              BIGSERIAL PK
memo_project_id BIGINT NOT NULL FK → MemoProject (ON DELETE CASCADE)
character_id    BIGINT NOT NULL FK → Character
created_at      TIMESTAMP NOT NULL

UNIQUE (memo_project_id, character_id)
무결성 (애플리케이션 검증): Character.project_id = 본 MemoProject 의 project_id 일치
```

#### SessionNote (8 필드)

```
id              BIGSERIAL PK
project_id      BIGINT NOT NULL FK → Project
body            TEXT (nullable, "다음 세션을 위한 한 줄", DESIGN.md 96 선택)
started_at      TIMESTAMP NOT NULL (세션 시작 시각, 클라이언트 보고)
ended_at        TIMESTAMP NOT NULL (세션 종료 시각)
word_count_at_end INTEGER NOT NULL (세션 종료 시점 자수)
created_at      TIMESTAMP NOT NULL (행 생성 시각, 표준 의미)
updated_at      TIMESTAMP NOT NULL

인덱스: (project_id, ended_at DESC)
```

#### ApiToken (모바일 캡처용 장기 유효 토큰)

```
id              BIGSERIAL PK
user_id         BIGINT NOT NULL FK → Users
token_hash      VARCHAR NOT NULL UNIQUE (SHA-256)
token_prefix    VARCHAR(8) NOT NULL (UI 식별용 평문 접두사)
label           VARCHAR NOT NULL default '새 토큰'
last_used_at    TIMESTAMP (nullable, 매 캡처 시 갱신)
created_at      TIMESTAMP NOT NULL
revoked_at      TIMESTAMP (nullable, 해지 시각)

인덱스: token_hash UNIQUE, (user_id, revoked_at)

토큰 형태: 'wnt_' + base62 무작위 32자 = 총 36자. 발급 시 1회만 원본 표시
```

### 2-3. 권한 정책 (Supabase RLS 대체 — Service 레이어)

모든 Service 메서드:
- 입력에 `userId` 받음 (Spring Security `@AuthenticationPrincipal` 에서 추출)
- Repository 호출 시 `userId` 필터 강제
- 다른 user 의 리소스 접근 시 `EntityNotFoundException` 반환 (404 — 정보 노출 회피)

---

## 3. API 엔드포인트 계약

### 3-1. 공통 규약

#### 응답 래퍼

```json
// 성공
{ "success": true, "data": {...} }

// 실패
{ "success": false, "error": { "code": "ERROR_CODE", "message": "사용자 메시지" } }
```

#### 페이지네이션

- 요청: `?page=0&size=20&sort=updatedAt,desc`
- 응답: `Page<T>` = `{ content: [...], totalElements, totalPages, page, size }`
- 최대 `size = 100`

#### 인증 헤더

- JWT: `Authorization: Bearer eyJ...` (브라우저)
- ApiToken: `Authorization: Bearer wnt_...` (iOS Shortcut, `POST /api/capture` 만)
- 서버가 접두사 (`eyJ` vs `wnt_`) 로 분기 검증

#### 멱등성

- `POST /api/capture` 만 `Idempotency-Key` 헤더 수용. 같은 키 받으면 *이전 응답 그대로 반환* (메모 중복 생성 방지)
- 캐시: 5분 메모리 TTL (단일 Render 인스턴스)

#### 기타

- 시간 형식: ISO 8601 (예: `2026-05-22T14:30:00Z`)
- API 경로 접두사: `/api/...`
- DTO 네이밍: `Create{Entity}Request` / `Update{Entity}Request` / `{Entity}Response`
- 문서화: springdoc-openapi 자동 생성 (`/swagger-ui.html`, `/api-docs/**` — 개발/스테이징만 노출)

#### 에러 코드 매트릭스

| HTTP | 의미 | 예시 코드 |
|---|---|---|
| 400 | 입력 검증 실패 | `PASSWORD_TOO_WEAK`, `EMAIL_INVALID_FORMAT`, `VALIDATION_FAILED` |
| 401 | 인증 실패 | `AUTH_TOKEN_MISSING`, `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_REVOKED`, `LOGIN_LOCKED` |
| 403 | 권한 없음 | `INSUFFICIENT_PERMISSION` |
| 404 | 리소스 없음 (다른 user 리소스 접근 포함) | `RESOURCE_NOT_FOUND` |
| 409 | 충돌 | `DOCUMENT_VERSION_CONFLICT`, `EMAIL_ALREADY_REGISTERED`, `KAKAO_ALREADY_LINKED` |
| 500 | 서버 오류 | `INTERNAL_SERVER_ERROR` |

### 3-2. 인증/사용자 엔드포인트 (12 개)

| # | 메서드 | 경로 | 본질 | 인증 |
|---|---|---|---|---|
| 1 | POST | `/api/auth/signup/email` | 이메일/비번 회원가입 + AuthToken EMAIL_VERIFY 생성 + 메일 발송 | X |
| 2 | POST | `/api/auth/verify-email` | 이메일 인증 토큰 검증 → email_verified_at 채움 | X |
| 3 | POST | `/api/auth/login` | 이메일/비번 로그인 → JWT access + refresh 발급. 5회 실패 시 30분 잠금 | X |
| 4 | GET | `/api/auth/oauth/kakao` | Kakao 로그인 페이지로 redirect (Spring OAuth2 자동) | X |
| 5 | GET | `/api/auth/oauth/kakao/callback` | Kakao 콜백 → user 생성/조회 + JWT 발급 + URL fragment redirect | X |
| 6 | POST | `/api/auth/password-reset/request` | 비밀번호 재설정 요청 + AuthToken PASSWORD_RESET 생성 + 메일 발송 | X |
| 7 | POST | `/api/auth/password-reset/confirm` | 재설정 토큰 + 새 비밀번호 → 변경 완료 | X |
| 8 | POST | `/api/auth/refresh` | refresh token → 새 access token | X (refresh 헤더) |
| 9 | POST | `/api/auth/logout` | refresh token DB row 삭제 (즉시 무효) | O |
| 10 | GET | `/api/auth/me` | 본인 정보 조회 (id / email / kakao 연결 여부 / email_verified_at / 활성 ApiToken 수) | O |
| 11 | POST | `/api/auth/link/kakao` | 로그인 상태에서 카카오 추가 연결 시작 (Kakao OAuth 흐름) | O |
| 12 | POST | `/api/auth/link/email` | 카카오 가입자가 이메일/비번 추가 (이메일은 카카오에서 받은 값, password_hash 만 입력) | O |

### 3-3. 프로젝트 / 등장인물 엔드포인트 (13 개)

**프로젝트 (7)**:

| # | 메서드 | 경로 | 본질 |
|---|---|---|---|
| 13 | GET | `/api/projects` | 사용자 프로젝트 목록 (페이지네이션 + `?archived=true` 필터) |
| 14 | GET | `/api/projects/{id}` | 단건 조회 |
| 15 | POST | `/api/projects` | 새 프로젝트 + Document 자동 생성 (1:1) |
| 16 | PATCH | `/api/projects/{id}` | 메타 부분 수정 |
| 17 | POST | `/api/projects/{id}/archive` | 보관 (archived_at = now) |
| 18 | POST | `/api/projects/{id}/unarchive` | 보관 해제 (archived_at = NULL) |
| 19 | DELETE | `/api/projects/{id}` | 영구 삭제 (cascade: Character / Document / SessionNote / MemoProject) |

**등장인물 (6) — nested 경로**:

| # | 메서드 | 경로 | 본질 |
|---|---|---|---|
| 20 | GET | `/api/projects/{projectId}/characters` | 인물 목록 (display_order 정렬) |
| 21 | GET | `/api/projects/{projectId}/characters/{id}` | 단건 조회 |
| 22 | POST | `/api/projects/{projectId}/characters` | 새 인물 생성 |
| 23 | PATCH | `/api/projects/{projectId}/characters/{id}` | 부분 수정 |
| 24 | PUT | `/api/projects/{projectId}/characters/reorder` | 정렬 배치 갱신 (전체 새 순서 전송) |
| 25 | DELETE | `/api/projects/{projectId}/characters/{id}` | 삭제 |

### 3-4. 본문 엔드포인트 (4 개 — flat 3 + nested 1)

| # | 메서드 | 경로 | 본질 |
|---|---|---|---|
| 26b | GET | `/api/projects/{projectId}/document` | **(006 신설)** 프로젝트 본문 1:1 조회 — frontend 가 projectId 로 진입 (clarify Q1) |
| 26 | GET | `/api/documents/{id}` | 본문 조회 (body + version + word_count + title) |
| 27 | PUT | `/api/documents/{id}` | 자동 저장 (body + version → optimistic lock + word_count 서버 갱신 + version +1). 충돌 시 409 + currentVersion + currentBody 반환 |
| 28 | PATCH | `/api/documents/{id}/title` | 제목 수정 (자동 저장 PUT 과 분리 — 빈도 다름) |

자동 저장 흐름:
- 클라이언트 800ms debounce → `PUT` 요청 페이로드 `{ body, version }`
- 서버 성공 응답: 200 OK + `{ id, body, word_count, version: newVersion, updated_at }`
- 서버 충돌 응답: 409 + `{ code: 'DOCUMENT_VERSION_CONFLICT', currentVersion, currentBody }` → 클라이언트 경고 토스트 + 다시 로드 vs 덮어쓰기 선택 UI

### 3-5. 메모 / 큐레이션 / 캡처 / 핀 엔드포인트 (9 개)

**메모 기본 CRUD (4)**:

| # | 메서드 | 경로 | 본질 |
|---|---|---|---|
| 29 | GET | `/api/memos` | 메모 목록 (페이지네이션 + 필터: `unclassified=true` / `projectId=X` / `characterId=Y` / `tag=Z` / `q=텍스트` / `pinned=true`). 각 메모에 연결 프로젝트 / 인물 / 태그 / 핀 상태 포함 (N+1 회피 — `@EntityGraph`) |
| 30 | GET | `/api/memos/{id}` | 단건 조회 |
| 31 | PATCH | `/api/memos/{id}` | 메모 본문 수정 (body 오타 / reason_note / tags) |
| 32 | DELETE | `/api/memos/{id}` | 메모 삭제 (cascade: MemoProject / MemoProjectCharacter / Document.body memo-pin mark 청소) |

**데스크탑 캡처 (1)**:

| 33 | POST | `/api/memos` | 데스크탑 ⌘+N 빠른 입력. JWT 인증. body + active_project_at_capture 자동 |

**모바일 캡처 (1)**:

| 34 | POST | `/api/capture` | iOS Shortcut. ApiToken 인증 + `Idempotency-Key` 헤더. body 필수. source=MOBILE 자동 |

**통합 큐레이션 (1)**:

| 35 | PUT | `/api/memos/{id}/curation` | 큐레이션 카드 저장 = 1 API. 페이로드 = `{ project_connections: [{ project_id, character_ids: [...] }], tags: [...], reason_note }`. 서버 차이 계산 후 MemoProject + MemoProjectCharacter + Memo.reason_note + tags 단일 트랜잭션 갱신 |

**핀 (2)**:

| # | 메서드 | 경로 | 본질 |
|---|---|---|---|
| 36 | POST | `/api/memos/{id}/pin` | 핀 박기. 페이로드 `{ document_id, document_version, position }`. Memo.pinned_document_id 갱신 + Document.body 에 memo-pin mark 추가 (단일 트랜잭션 + Document version 검증) |
| 37 | DELETE | `/api/memos/{id}/pin` | 핀 해제. Memo.pinned_document_id = NULL + Document.body mark 제거 |

### 3-6. 세션 노트 + 모바일 캡처용 토큰 (9 개)

**세션 노트 (5)**:

| # | 메서드 | 경로 | 본질 |
|---|---|---|---|
| 38 | POST | `/api/projects/{projectId}/session-notes` | 세션 종료 모달 제출 → 새 세션 노트 생성 |
| 39 | GET | `/api/projects/{projectId}/session-notes/latest` | 가장 최근 세션 노트 1 행 (홈 카드 hero + 작성 화면 last-session-bar source). 없으면 404 |
| 40 | GET | `/api/projects/{projectId}/session-notes` | 세션 노트 목록 페이지네이션 (활동 피드, ended_at DESC) |
| 41 | PATCH | `/api/projects/{projectId}/session-notes/{id}` | body 수정 (오타) — started_at / ended_at / word_count_at_end 불변 |
| 42 | DELETE | `/api/projects/{projectId}/session-notes/{id}` | 삭제 |

**ApiToken 관리 (4)**:

| # | 메서드 | 경로 | 본질 |
|---|---|---|---|
| 43 | POST | `/api/api-tokens` | 새 토큰 발급. 응답에 **원본 토큰 1 회만 표시** + token_prefix + label + created_at |
| 44 | GET | `/api/api-tokens` | 본인 토큰 목록 (token_prefix / label / last_used_at / created_at / revoked_at) — 원본 미포함 |
| 45 | PATCH | `/api/api-tokens/{id}` | label 변경 |
| 46 | DELETE | `/api/api-tokens/{id}` | 해지 (revoked_at = now). DB row 유지 (감사) |

### 3-7. 엔드포인트 합계 = 47 개 (006 nested document `GET /api/projects/{projectId}/document` 1 추가)

---

## 4. 인증/인가

### 4-1. JWT 형태

- **알고리즘**: HS256 (단일 Spring Boot 서버, 비밀키 = 환경변수 `JWT_SECRET`)
- **access token**:
  - 만료: 1 시간
  - 저장: 프론트 localStorage
  - payload: `{ sub: user_id, email, exp, iat }`
- **refresh token**:
  - 만료: 30 일
  - 저장: **DB** (AuthToken 통합 테이블에 `type=REFRESH` 행)
  - 무효화: logout 시 즉시 DB row 삭제 → 다음 refresh 요청 거부
- **rotation**: V1 미적용 (refresh 만료까지 재사용 가능). V2 검토

### 4-2. Kakao OAuth 흐름

- Spring Security OAuth2 클라이언트 자동 (`spring-boot-starter-oauth2-client`)
- 커스텀 `OAuth2UserService` — Kakao 응답 → user 생성/조회
- success handler — JWT 발급 + 프론트로 URL fragment redirect (`/auth/success#access=...&refresh=...`)
- redirect_uri = Render 도메인 + Kakao Developers 콘솔 등록
- scope = `profile_nickname`, `account_email`
- 신규 가입자 = email_verified_at 즉시 채움 (Kakao 가 이메일 보증)
- 기존 이메일 가입자 충돌 = 로그인 안 한 상태면 에러 (`KAKAO_EMAIL_ALREADY_REGISTERED` + 로그인하기 인라인 링크 메시지), 로그인 상태면 추가 연결 (Q②-1 B 의 다중 연결 정책)

### 4-3. 비밀번호 정책

- 알고리즘: **BCrypt** (Spring Security 표준)
- cost factor: **12**
- 최소 길이: **12 자**
- 복잡도: **영문 + 숫자 + 특수문자** 강제
- 검증 위치: **클라이언트 + 백엔드 둘 다** (백엔드 우회 공격 방어)
- 실패 응답: 400 + `PASSWORD_TOO_WEAK` + 메시지

### 4-4. Spring Security 필터 체인 구조

```
요청 →
  1. CORS 필터
  2. CSRF 비활성 (REST + JWT 표준)
  3. LoginAttemptFilter (`/api/auth/login` URL 만 매칭 — 5회 실패 잠금 검증)
  4. JwtAuthenticationFilter (`Authorization: Bearer eyJ...`)
  5. ApiTokenAuthenticationFilter (`Authorization: Bearer wnt_...` — `/api/capture` 한정)
  6. AuthorizationFilter (Spring 표준)
  7. Controller 도달
```

#### 공개 엔드포인트 (인증 불필요)

- `/api/auth/signup/*`, `/api/auth/verify-email`, `/api/auth/login`, `/api/auth/oauth/kakao*`, `/api/auth/password-reset/*`, `/api/auth/refresh`
- `/swagger-ui.html`, `/api-docs/**` (개발/스테이징만)

#### 보호 엔드포인트 — JWT 필요

위 외 모든 `/api/**`

#### ApiToken 허용 — `POST /api/capture` 만

#### 401 응답 5 에러 코드

| 코드 | 의미 | 클라이언트 처리 |
|---|---|---|
| `AUTH_TOKEN_MISSING` | Authorization 헤더 없음 | 로그인 페이지로 |
| `AUTH_TOKEN_INVALID` | 형식 잘못 / 서명 검증 실패 | 로그인 페이지로 |
| `AUTH_TOKEN_EXPIRED` | JWT exp 지남 | 자동 refresh 시도 |
| `AUTH_TOKEN_REVOKED` | ApiToken.revoked_at 또는 RefreshToken DB row 미존재 | 로그인 페이지로 + 토큰 정리 |
| `LOGIN_LOCKED` | 5회 실패 후 잠금 (lockout_until > now) | alert-error 표시 + 30분 후 재시도 안내 (DESIGN.md 361) |

### 4-5. 권한 정책 (role)

V1 = 단일 role (모든 사용자 = user). 권한 매트릭스 코드 없음. V2 admin 진입 시 확장.

### 4-6. CORS 정책

- 허용 origin: **와일드카드 `*`** (V1 본인 1명 + credentials=false 환경에서 충분)
- 허용 메서드: GET, POST, PUT, PATCH, DELETE, OPTIONS
- 허용 헤더: `Authorization`, `Content-Type`, `Idempotency-Key`, `Accept`
- 노출 헤더: `Location`
- credentials: **false** (Q④-1 localStorage 토큰 정합 — Cookie 미사용)
- preflight `max-age`: 3600 (1 시간)

V2 외부 사용자 진입 시 명시 list 또는 `*.vercel.app` 패턴으로 좁힘 검토.

---

## 5. 보류 결정 / V1.5 후보

본 grill 에서 *명시적으로 처리* 된 보류 결정 10 건:

### 5-1. 해소된 보류 결정 (6 건)

| # | 영역 | 결정 |
|---|---|---|
| 1 | 다중 디바이스 동시 편집 충돌 | optimistic lock (Document.version) + 409 Conflict + 클라이언트 경고 토스트 (Q②-8 C) |
| 2 | 메모 핀 위치 추적 | Memo.pinned_document_id + Document.body 의 memo-pin custom mark (혼합 형태). ProseMirror step.mapping 자동 처리 (Q②-10 C) |
| 3 | 5회 실패 + 30분 제한 구현 | Spring Security 필터 + 사용자 테이블 인라인 (failed_login_count + lockout_until) (Q②-3 A + Q④-4 B 분리 필터) |
| 4 | 토큰 보조 테이블 | AuthToken 통합 + type 컬럼 (EMAIL_VERIFY / PASSWORD_RESET / REFRESH) (Q②-4 B + Q④-1 C 확장) |
| 5 | 모바일 캡처 PWA vs Shortcut | **PWA + Shortcut 병행** — 프론트 결정 영역. 백엔드 = `POST /api/capture` 가 둘 다 사용 (ApiToken 인증 동일) |
| 6 | 한국어 IME (DESIGN.md #2) | PoC 0-1 통과 박힘 (00-stack §10 변경 이력) — TipTap 한국어 4 회귀 케이스 모두 정상 |

### 5-2. V1.5 후보로 박힘 (4 건)

| # | 영역 | 본 명세 처리 |
|---|---|---|
| 7 | 모바일 메모 큐레이션 (DESIGN.md #3) | **V1 데스크탑 전용**. V1.5 모바일 큐레이션 UI 추가 시 백엔드 API (`PUT /api/memos/{id}/curation`) 그대로 사용 가능 — 프론트 결정 영역 |
| 8 | 여러 문서 vs 단일 문서 (DESIGN.md #5) | **MVP 프로젝트당 1 문서** (Document.project_id UNIQUE). V1.5 진입 시 결정 — UNIQUE 제거 + 1:N 변경 또는 Chapter 엔티티 신설 |
| 9 | 모바일 화면 우선순위 (00-stack §7) | **V1 모바일 = 캡처 + inbox 조회만**. 모바일 큐레이션 / 작성 V1.5 이후. 프론트 결정 영역 |
| 10 | 모바일 캡처 PWA vs Shortcut 병행 (00-stack §7) | 위 #5 와 동일 — 병행 채택 |

---

## 6. 변경 이력 (본 grill 결정 표)

| 날짜 | 영역 | 결정 | 선택지 |
|---|---|---|---|
| 2026-05-22 | ① 명세 위치 | `docs/plan/03-backend-requirements.md` (plan 레이어 4번째) | A |
| 2026-05-22 | ① 명세 무게 | 중간 (8~12 페이지, 도메인 + API + 인증 + 보류 결정 + 변경 이력) | Mid |
| 2026-05-22 | ②-1 사용자 인증 방법 | B (둘 다 연결 가능) | B |
| 2026-05-22 | ②-2 사용자 필드 보강 | A (3 필드 모두 추가 — email_verified_at + last_login_at + updated_at) | A |
| 2026-05-22 | ②-3 5회 실패 정책 | A (사용자 테이블 인라인 + Spring Security 필터) | A |
| 2026-05-22 | ②-4 토큰 보조 테이블 | B (AuthToken 통합 + type 컬럼) | B |
| 2026-05-22 | ②-5 Project 형태 | B (자수 + archived_at TIMESTAMP + 도출) | B |
| 2026-05-22 | ②-6 Character 형태 | B (메타 + display_order) | B |
| 2026-05-22 | ②-7 Document body | A (ProseMirror JSON / JSONB) | A |
| 2026-05-22 | ②-8 Document 충돌 | C (version 컬럼 + optimistic lock + 409) | C |
| 2026-05-22 | ②-9 Memo 핀 외 | A (plain text + text[] tags + 메타) | A |
| 2026-05-22 | ②-10 Memo 핀 | C (혼합 — pinned_document_id + body mark) | C |
| 2026-05-22 | ②-11 MemoProject | B (별도 MemoProjectCharacter 테이블) | B |
| 2026-05-22 | ②-12 SessionNote | A (started_at + ended_at + created_at + updated_at) | A |
| 2026-05-22 | ②-13 ApiToken | A (last_used_at + token_prefix) | A |
| 2026-05-22 | ③-1 API 공통 규약 | B (글로벌 표준 + 멱등성 키) | B |
| 2026-05-22 | ③-2 인증 엔드포인트 | A (12 엔드포인트 모두) | A |
| 2026-05-22 | ③-3 프로젝트/등장인물 | A (13 엔드포인트 모두) | A |
| 2026-05-22 | ③-4 본문 | A (flat 경로 + GET/PUT/PATCH title) | A |
| 2026-05-22 | ③-5 메모/큐레이션 | A (통합 PUT 큐레이션) | A |
| 2026-05-22 | ③-6 세션 노트/ApiToken | A (9 엔드포인트 모두) | A |
| 2026-05-22 | ④-1 JWT 형태 | C (refresh DB 저장 + 즉시 무효) | C |
| 2026-05-22 | ④-2 Kakao OAuth | A (Spring 자동 + URL fragment) | A |
| 2026-05-22 | ④-3 비밀번호 정책 | B (BCrypt 12 + 12자 + 영문/숫자/특수) | B |
| 2026-05-22 | ④-4 Security 필터 체인 | B (3 필터 분리) | B |
| 2026-05-22 | ④-5 CORS | C (와일드카드 `*`) | C |
| 2026-05-22 | ⑤ 보류 결정 처리 | A (위임 + V1.5 박힘 + §"보류 결정" 기록) | A |
| 2026-05-22 | ⑤-2 여러 문서 | A (1:1 유지, V1.5 진입 시 결정) | A |
| 2026-05-22 | ⑥ 산출 위치 | A (plan/03 + 즉시 작성) | A |
| 2026-05-25 | 004 R-1 | Project archived boolean → archived_at timestamp 마이그레이션 (`UPDATE archived_at = updated_at WHERE archived = TRUE`) | research R-1 default |
| 2026-05-25 | 004 R-2 | 메타 5 필드 길이 상한 (genre 100 / target 1~100M / tone 2000 / synopsis 5000 / world 10000) | research R-2 default — SoT 미명시 영역 |
| 2026-05-25 | 004 R-3 | Document body DB DEFAULT = `'{"type":"doc","content":[]}'::jsonb` (TipTap empty doc) | research R-3 (PoC 0-1 정합) |
| 2026-05-25 | 004 R-4 | Character display_order DB DEFAULT 0 + 동순위 created_at ASC 정렬 | research R-4 default |
| 2026-05-27 | 004 Phase 7 ValidationException | 도메인 검증 실패 = 400 VALIDATION_FAILED (신규 예외 클래스 + GlobalExceptionHandler 매핑). IllegalArgumentException 의 INVALID_PARAMETER 와 분리 | contracts/character-endpoints #24 정합 |
| 2026-05-30 | 006 clarify Q1 | 본문 조회 nested endpoint 신설 `GET /api/projects/{projectId}/document` (frontend 가 projectId 로 1회 조회). §3-4 = flat 3 + nested 1 = **4 endpoint** | spec 006 clarify |
| 2026-05-30 | 006 ②-8 재확정 | Document 충돌 = 409 + 다시 로드/덮어쓰기 **사용자 선택 UI** (last-write-wins 폐기, 00-stack §7 / 01-phase 3-8 정정 동기) | spec 006 / §3-4 정합 |
| 2026-05-31 | 006 Week3+4 구현 | Document 자동저장 API + Memo/MemoProject/MemoProjectCharacter/ApiToken 4 entity (V6 마이그레이션) + 캡처/큐레이션/토큰. **메모 핀(②-10 #36/#37) + 세션노트(③-6) 는 Week5 로 명시 제외** | spec 006 |

---

## 7. 본 명세 사용 가이드

- **본 명세는 백엔드 코드 작성 진입 직전의 통합 SoT**. Phase 단위 spec (`specs/`) 작성 시 본 문서 인용
- **변경 발생 시**: 본 §6 변경 이력에 행 추가 + 해당 §1~§5 갱신
- **NFR / 운영 / 인프라 detail / 마이그레이션 전략**: 본 명세 외 영역. 백엔드 코드 작성 중 발견 시 `docs/plan/02-progress.md` 의 "별도 정리 트랙" 으로 분리 표시
- **V1.5 진입 시점**: V1 출시 + 4주 dogfooding 후 결정 (DESIGN.md 169, 178). 본 §5 의 V1.5 후보 4 건 그때 재검토
