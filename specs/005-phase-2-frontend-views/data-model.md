# Phase 1 Data Model: 005 Frontend Views & Auth Integration

**Date**: 2026-05-28 | **Plan**: [plan.md](./plan.md)

본 spec 은 **DB 변경 0** (영속 모델 SoT = 003 `users`/`auth_tokens` + 004 `projects`/`characters`/`documents`). 본 문서는 **frontend 표시·입력 모델 + 인증 세션(쿠키) + 클라이언트 상태** 를 정의한다. 백엔드 필드는 004 contracts(`project-endpoints.md` / `character-endpoints.md`) + 003 `auth-endpoints.md` 정합.

---

## 1. 인증 세션 (httpOnly 쿠키)

frontend 는 토큰을 **직접 보관하지 않는다**(httpOnly — JS 접근 불가). 세션은 브라우저 쿠키에 산다.

| 쿠키 | 내용 | 속성 | Max-Age |
|---|---|---|---|
| `access_token` | JWT (HS256) | HttpOnly, SameSite=Lax, Path=/, Secure(env), Domain 미지정 | 3600 (1h) |
| `refresh_token` | 평문 refresh | HttpOnly, SameSite=Lax, Path=/, Secure(env), Domain 미지정 | 2592000 (30일) |

- **인증 상태 단일 판단원** = `GET /api/auth/me` (200=로그인 / 401=비로그인). React Query key `['auth','me']`.
- **AuthMe** (표시 모델 — 003 `AuthMeResponse` 정합):

  | 필드 | 타입 | 설명 |
  |---|---|---|
  | `userId` | number | 사용자 식별자 |
  | `email` | string | 이메일 |
  | `kakaoLinked` | boolean | 카카오 연결 여부 |
  | `emailVerifiedAt` | string \| null | 이메일 인증 시각(ISO) |
  | `activeApiTokenCount` | number | 활성 API 토큰 수(Week 4 전 항상 0) |

---

## 2. Project (표시 모델 — 004 `ProjectResponse` 정합)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | number | 프로젝트 식별자 |
| `title` | string | 제목 |
| `genre` | string \| null | 장르(자유 텍스트) |
| `targetLength` | number \| null | 목표 분량(자/단어) |
| `toneNotes` | string \| null | 톤·문체 노트 |
| `synopsis` | string \| null | 시놉시스 |
| `worldNotes` | string \| null | 세계관 메모 |
| `archivedAt` | string \| null | 보관 시각(null=활성) |
| `createdAt` | string | 생성 시각(ISO) |
| `updatedAt` | string | 수정 시각(ISO) |

- 목록 = `PagedResult<Project>` (`content` / `totalElements` / `totalPages` / `page` / `size` — 004 페이지네이션 정합).

---

## 3. Character (표시 모델 — 004 `CharacterResponse` 정합)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | number | 인물 식별자 |
| `projectId` | number | 소속 프로젝트 |
| `name` | string | 이름 |
| `shortDescription` | string \| null | 한 줄 설명 |
| `notes` | string \| null | 자유 노트 |
| `displayOrder` | number | 표시 순서 |
| `createdAt` | string | 생성 시각(ISO) |
| `updatedAt` | string | 수정 시각(ISO) |

- 목록 = `PagedResult<Character>` (표시 순서 오름차순, 동순위 생성 순 — 004 정렬 정합).

---

## 4. 입력 모델 (폼)

| 입력 | 필드 | 검증(클라이언트 최소 — 서버가 SoT) |
|---|---|---|
| `LoginInput` | email, password | required |
| `SignupEmailInput` | email, password | required, email 형식 |
| `PasswordResetRequestInput` | email | required |
| `PasswordResetConfirmInput` | token, newPassword | required |
| `CreateProjectInput` | title(필수), genre/targetLength/toneNotes/synopsis/worldNotes(선택) | title required |
| `UpdateProjectInput` | 위 6필드 모두 optional(null=미변경) | — |
| `CreateCharacterInput` | name(필수), shortDescription/notes/displayOrder(선택) | name required |
| `UpdateCharacterInput` | 위 4필드 optional(null=미변경) | — |
| `ReorderCharactersInput` | characterIds: number[] | 전체 순서 |

서버 검증 실패(400 `VALIDATION_FAILED` / `EMAIL_INVALID_FORMAT` / `PASSWORD_TOO_WEAK` 등)는 폼에 메시지로 표시(R-6).

---

## 5. React Query keys

| key | 용도 | 무효화 시점 |
|---|---|---|
| `['auth','me']` | 인증 상태 + 본인 정보 | login/logout 후 |
| `['projects', { archived, page, size, sort }]` | 홈 목록 | create/archive/unarchive/delete 후 |
| `['project', id]` | 단건 메타 | patch/archive 후 |
| `['characters', projectId]` | 인물 목록 | create/patch/reorder/delete 후 |

---

## 6. 클라이언트 상태 (Zustand)

| store | 상태 | 본 spec 변경 |
|---|---|---|
| `ui.ts` | 로컬 UI(패널 등) | 유지 |
| `preferences.ts` | 테마(라이트/다크/시스템) | 유지 |
| `authPlaceholder.ts` | 임시 `X-User-Id` | **폐기**(R-9, ISSUE-015) — 인증은 쿠키 + `/me` |

---

## 7. 상태 전이 (인증 세션)

```text
[비로그인] --로그인 성공(Set-Cookie)--> [로그인]
[로그인] --access 만료 + 보호요청 401--> [refresh 시도]
[refresh 성공(Set-Cookie)] --> [로그인]
[refresh 실패 401] --> [비로그인 → 로그인 화면 안내]
[로그인] --로그아웃(Max-Age=0)--> [비로그인]
```

- 인증 가드(FR-025): 보호 화면 진입 시 `['auth','me']` 확인 → 401 이면 로그인 안내.
