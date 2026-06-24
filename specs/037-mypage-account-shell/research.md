# Phase 0 Research: 마이페이지 계정 셸 재구성

## D1. 라우트 구조 — Next App Router 중첩 라우트

**Decision**: `app/(main)/mypage/layout.tsx`(사이드 메뉴 셸) + 하위 세그먼트 `profile`·`settings`·`connections`·`withdraw` 각 `page.tsx`. `/mypage` 는 `/mypage/profile` 로 리다이렉트.

**Rationale**: 사용자 결정(중첩 라우트). layout 이 사이드 메뉴를 공유하고 각 섹션은 독립 URL → 딥링크·새로고침·뒤로가기 자연 동작(FR-002). 기존 `(main)/layout.tsx` 가 중첩 layout 패턴을 이미 쓰고 next docs 디렉토리 존재(구현 시 참고 가능).

**Alternatives considered**: 단일 페이지 `?tab=` 쿼리 전환 — 딥링크·새로고침 약함, 사용자가 중첩 라우트 선택.

## D2. `/settings` 리다이렉트 — next.config redirects()

**Decision**: `next.config.ts` 의 기존 `redirects()` 에 `{ source: '/settings', destination: '/mypage/settings', permanent: false }` 추가. 기존 `app/(main)/settings/page.tsx` 제거.

**Rationale**: `next.config` 가 이미 redirects()·rewrites() 사용 중 → 일관. 정적 리다이렉트라 서버 컴포넌트 redirect() 보다 단순. 북마크·외부 링크 보존(FR-006). `permanent: false`(308 아님) — 추후 IA 재변경 여지.

**Alternatives considered**: `settings/page.tsx` 를 `redirect("/mypage/settings")` 서버 컴포넌트로 — 파일 잔존·중복. next.config 가 깔끔.

## D3. 기존 settings 화면 분해 — 컴포넌트 추출 후 재배치

**Decision**: 기존 `settings/page.tsx` 의 4블록을 컴포넌트로 추출 — 테마·기본 용지·일일 목표 → `PreferencesSections`, 회원 탈퇴(모달 포함) → `WithdrawSection`. 계정 정보 블록은 036 `AccountInfoSection`(프로필 섹션)으로 흡수, 문의 카드는 사이드 메뉴 문의 항목으로.

**Rationale**: 동작 보존하며 위치만 이동(FR-005·FR-012, surgical). 중복 구현 회피. preferences 스토어(Zustand)·`["auth","me"]` 쿼리 그대로 재사용.

## D4. 계정 연결 — 기존 흐름 재사용, 해제 없음

**Decision**: 연결 상태는 `kakaoLinked`(기존) + `passwordSet`(신규 additive)로 파생. 미연결 수단만 액션 노출:
- 이메일 가입자(카카오 미연결) → 카카오 추가 연결(POST `/api/auth/link/kakao`)
- 카카오 가입자(비밀번호 미설정) → 비밀번호 추가 등록(POST `/api/auth/link/email`)
해제(unlink)는 **백엔드 endpoint 부재** → 미제공(FR-010).

**Rationale**: `/link/kakao`·`/link/email` 실재 확인. unlink grep 결과 부재. 연결 추가만 안전.

## D5. 비밀번호 설정 여부 노출 — AuthMeResponse.passwordSet (additive)

**Decision**: `AuthMeResponse` 에 `passwordSet: Boolean` 추가. `UserAuthConverter` 에서 `user.passwordHash != null` 매핑.

**Rationale**: 계정 연결 UI 가 "비밀번호 추가 등록" 버튼 노출 여부를 판단하려면 현재 비밀번호 설정 상태가 필요. 현재 응답엔 `kakaoLinked` 만 있고 비밀번호 설정 여부 부재(코드 확인). additive 라 기존 클라이언트 무영향. 해시값 자체는 노출하지 않고 boolean 만.

**Alternatives considered**: 비밀번호 설정 여부를 별도 endpoint — 과함. me() additive 재사용.

## D6. 카카오 추가 연결 시작의 브라우저 흐름 — R2 실측 (불확실)

**Decision (잠정)**: 백엔드 `POST /api/auth/link/kakao` 는 session 에 linkUserId 박고 302 `/api/auth/oauth/kakao` 반환. 프론트는 공용 client 로 POST(X-WriteNote-Client 헤더·credentials 포함) → 성공 시 `window.location.href = "/api/auth/oauth/kakao"` 로 OAuth 진입. **단 fetch 의 302 처리·CSRF·session 동작은 R2 에서 실측해 확정**(redirect:'manual' opaque 여부·헤더 요구).

**Rationale**: POST + 302 + 외부 OAuth 조합은 fetch 단독으로 매끈하지 않다(opaqueredirect). 추측으로 단정하지 않고 R2 dogfooding 에서 트리거 방식을 실측(메모리 [[security-csrf-and-ip-throttle]] CSRF 헤더 의존, [[deployment-live]] 프록시 구조 고려).

**Alternatives considered**: 순수 `<form method=post>` — CSRF 커스텀 헤더 주입 불가로 CsrfDefenseFilter 403 위험. 직접 `window.location` GET — endpoint 가 POST 라 405. → 실측으로 확정.

## D7. 배포 순서

**Decision**: R1(셸·환경설정 흡수) = FE 단독(BE 0) → 즉시 배포 가능. R2(계정 연결) = BE `passwordSet` additive 선행 배포 → FE 후행(FE 가 passwordSet 읽음).

**Rationale**: R1 은 백엔드 계약 변경 0이라 FE 단독 안전. R2 는 FE 가 새 필드(passwordSet)를 읽으므로 BE 선행(CLAUDE.md 방향 의존).
