# Contract: Screen Data Flow

**Date**: 2026-05-28 | **Plan**: [../plan.md](../plan.md)

화면 5종 + 인증 폼별 데이터 흐름 ↔ backend endpoint(003/004) 매핑. 각 화면의 query/mutation, 빈/로딩/에러 상태, 성공 후 이동.

---

## 1. 홈 view (`/`) — US1/R2

| 항목 | 내용 |
|---|---|
| 가드 | `requireAuth`(`/me`) — 401 → 로그인 |
| query | `listProjects({archived:false, page:0, size:20, sort:'updatedAt,desc'})` |
| 빈 상태 | `totalElements===0` → EmptyHero(H0) + "첫 프로젝트 만들기" CTA → `/projects/new` |
| 목록 | 프로젝트 카드(제목 + 진행률 ring placeholder + 지난 세션 placeholder — Week 5) |
| 에러 | 재시도 가능 에러 표시(현 골격은 isError→empty 취급 — R2 에서 분리) |

**T051 재검증(SC-002)**: 로그인된 쿠키 세션으로 목록 unwrap 성공(이전 401).

---

## 2. 새 프로젝트 (`/projects/new`) — US2/R3

| 항목 | 내용 |
|---|---|
| 가드 | requireAuth |
| 입력 | title(필수) + genre/targetLength/toneNotes/synopsis/worldNotes(선택) |
| mutation | `createProject(input)` → 201 |
| 성공 | `['projects']` 무효화 + `/projects/{id}` 이동(FR-017) |
| 검증 실패 | 400 `VALIDATION_FAILED` → 폼 메시지(title 누락/길이) |

---

## 3. 프로젝트 메타 카드 (`/projects/[id]`) — US3/R4

| 항목 | 내용 |
|---|---|
| 가드 | requireAuth |
| query | `getProject(id)` → 메타 카드 표시(빈 필드는 비어 있음 표시) |
| 액션 | 편집(`/projects/[id]/edit`) / 보관 / 보관해제 / 삭제(확인) / 등장인물(`/projects/[id]/characters`) |
| 404 | 본인 소유 아님/미존재 → 안내(존재 비노출) |

### 편집 (`/projects/[id]/edit`)

| 항목 | 내용 |
|---|---|
| query | `getProject(id)` 로 초기값 |
| mutation | `updateProject(id, input)`(PATCH, null=미변경) |
| 성공 | `['project',id]` + `['projects']` 무효화 + `/projects/[id]` 복귀 |

### lifecycle

| 액션 | mutation | 결과 |
|---|---|---|
| 보관 | `archiveProject(id)` | 활성 목록 제거, 보관함 노출 |
| 보관해제 | `unarchiveProject(id)` | 반대 |
| 삭제 | `deleteProject(id)`(확인 후) | 204, 목록 제거, 등장인물 cascade |

---

## 4. 등장인물 (`/projects/[id]/characters`) — US4/R5

| 항목 | 내용 |
|---|---|
| 가드 | requireAuth |
| query | `listCharacters(projectId)` → 표시 순서대로 |
| 생성 | `createCharacter`(name 필수) → 목록 끝 추가 |
| 편집 | `updateCharacter`(부분) |
| 삭제 | `deleteCharacter` |
| 재정렬 | `reorderCharacters(characterIds)` → 응답 목록으로 갱신(별도 GET 불필요). 빈 배열 no-op. 검증 실패(누락/중복/외부 ID) 400 |

---

## 5. 인증 폼 — US1/US5/US6 (R2/R6/R7)

| 폼 | mutation | 성공 | 주요 실패 |
|---|---|---|---|
| 로그인 | `login` | 쿠키 발급 + `['auth','me']` 무효화 + 홈 | 401 `EMAIL_NOT_VERIFIED`/`LOGIN_FAILED`/`LOGIN_LOCKED` |
| 회원가입 | `signupEmail` | 인증 메일 안내 | 409 `EMAIL_ALREADY_REGISTERED`, 400 `PASSWORD_TOO_WEAK` |
| 이메일 인증 | `verifyEmail(token)` | 로그인 가능 안내 | 401/409 토큰 무효/만료/사용됨 |
| 비번 재설정 요청 | `requestPasswordReset` | 항상 발송 안내(노출 회피) | 400 형식 |
| 비번 재설정 확정 | `confirmPasswordReset` | 새 비번 로그인 가능 | 토큰/정책 실패 |
| 카카오 로그인 | `/api/auth/oauth/kakao` 진입(브라우저 네비게이션) | 콜백 쿠키 발급 + 홈 | `/auth/login-error?code=...` |
| 카카오 추가 연결 | `POST /api/auth/link/kakao` | `/auth/link-success` | 409 `KAKAO_ALREADY_LINKED`/`KAKAO_LINK_CONFLICT` |

에러 code → 한국어 메시지 매핑(R-6, FR-012).
