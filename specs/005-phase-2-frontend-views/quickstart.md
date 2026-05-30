# Quickstart: 005 Frontend Views & Auth Integration (로컬 dogfooding)

**Date**: 2026-05-28 | **Plan**: [plan.md](./plan.md)

005 GREEN 후 로컬에서 "로그인 → 홈 → 새 프로젝트 → 메타 → 등장인물" 흐름을 직접 확인하는 절차. backend + frontend 동시 기동 + same-origin 프록시 전제.

---

## 1. 사전 조건

- 로컬 docker postgres 기동: `docker compose up -d --wait postgres`
- backend `.env`(또는 local profile)에 쿠키 secure env(`app.cookie.secure=false` 로컬) + `BACKEND_ORIGIN` 정합
- 가입·이메일 인증 완료된 계정 1개(없으면 §3 회원가입 흐름 먼저 — 또는 003 quickstart 로 계정 생성)

---

## 2. 기동

```bash
# 터미널 A — backend (포어그라운드, local profile)
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'

# 터미널 B — frontend dev (same-origin 프록시 활성)
cd frontend && pnpm dev
```

- 브라우저 `http://localhost:3000` 접속. `/api/*` 요청은 next rewrites 가 `localhost:8080` 으로 프록시(브라우저는 3000 만 인지 = same-origin).

---

## 3. 흐름 검증 (SC 매핑)

| 단계 | 동작 | 기대 | SC |
|---|---|---|---|
| 3-1 | 비로그인 상태로 `/` 접근 | 로그인 화면으로 안내 | SC-005 |
| 3-2 | 이메일·비밀번호 로그인 | 쿠키 발급(개발자도구 Application → Cookies 에 `access_token`/`refresh_token` HttpOnly) + 홈 이동 | SC-001 |
| 3-3 | 홈 목록 표시 | 프로젝트 0개 → H0 / 1+ → 카드 목록(**T051 GREEN**) | SC-002 |
| 3-4 | 브라우저 새로고침 | 재로그인 없이 목록 유지 | SC-003 |
| 3-5 | "새 프로젝트 만들기" → 제목 입력 → 생성 | `/projects/{id}` 이동 + 메타 카드 | SC-004 |
| 3-6 | 메타 편집 → 일부 필드 수정 | 변경 반영, 나머지 유지 | — |
| 3-7 | 보관 → 보관해제 → 삭제(확인) | 목록 반영, 삭제 시 등장인물 cascade | — |
| 3-8 | 등장인물 추가 → 편집 → 재정렬 → 새로고침 | 순서 유지 | SC-006 |
| 3-9 | 회원가입 → 이메일 인증 → 로그인 | 신규 계정 진입 | SC-007 |
| 3-10 | 로그아웃 | 쿠키 만료(Max-Age=0) + 로그인 화면 | — |

> 카카오 로그인(SC-007 일부)은 외부 카카오 인가 화면 + 앱 설정 의존 → 로컬 dogfooding 제약(R-7). 카카오 앱 redirect_uri 설정 후 별도 검증.

---

## 4. 자동 검증 게이트

```bash
# backend (쿠키 전환 회귀 — 003 헤더 케이스 GREEN 유지 + 쿠키 케이스)
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build

# frontend (RSC 경계 검출 위해 build 의무 — 002 회귀)
cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build

# SC-008 — X-User-Id 잔존 0건
grep -rn "X-User-Id" frontend/src || echo "OK: 0건"
```

---

## 5. 확인 포인트 (research 연동)

- **R-1/R-2**: 개발자도구에서 `Set-Cookie` 가 로그인 응답에 있고, 쿠키가 `localhost:3000` (프록시 host)에 host-only 로 심기는지.
- **R-3**: 헤더 없이 쿠키만으로 보호 endpoint(`/api/projects`) 200 인지(`/me` 200).
- **R-7**: access 쿠키 만료(1h 또는 강제 삭제) 후 보호 요청 → 자동 refresh → 재시도 성공.
