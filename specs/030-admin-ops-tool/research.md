# Phase 0 Research: 운영 툴 (Admin Ops Tool) v1

spec 에 NEEDS CLARIFICATION 0건(미확정은 Assumptions 로 기본값 고정). 본 문서는 구현 결정과 근거를 박는다. 모든 기존 패턴은 실제 코드(2026-06-21 Explore 조사)에서 확인.

## 1. 관리자 인증 — 단일 관리자 이메일 검사 (role 미도입)

- **Decision**: `/api/admin/**` 에 커스텀 `AuthorizationManager<RequestAuthorizationContext>` 를 등록해, 인증된 `AuthenticatedPrincipal.email` 이 설정값 `app.admin.email`(env `ADMIN_EMAIL`)과 일치할 때만 통과. 불일치 시 403. 인증 자체(JWT)는 기존 `JwtAuthenticationFilter` 재사용.
- **Rationale**: User 엔티티에 `role` 컬럼이 없음(확인됨). 솔로 운영(단일 관리자)이라 권한 체계는 과잉. 이메일 1개 비교로 충분하고 스키마 변경 0. SecurityConfig 가 이미 `.requestMatchers(...).access(...)`/`hasRole` 등 표현식을 지원.
- **Alternatives considered**:
  - `users.role` 컬럼 + `hasRole("ADMIN")`: 다인 운영 시 정석이나 현재 불필요 — 마이그레이션·엔티티·토큰 변경 발생. 운영자 다인화 시점으로 연기(spec Assumptions).
  - 각 어드민 컨트롤러에서 수동 `if (principal.email != adminEmail) throw`: 중앙화 안 됨·누락 위험. AuthorizationManager 로 경로 단위 중앙 통제 우선.
- **적용 위치**: `config/AdminAuthorizationManager.kt` 신규 + `SecurityConfig.kt` authorizeHttpRequests 에 `.requestMatchers("/api/admin/**").access(adminAuthorizationManager)`. `app.admin.email` 은 `application.yml`(기본 빈값) + `application-local.yml`(로컬 테스트용) + prod 는 env `ADMIN_EMAIL`.
- **검증**: 통합 테스트로 (a) 비인증 → 401, (b) 비관리자 JWT → 403, (c) 관리자 JWT → 200. (FR-015/016, SC-005)

## 2. 공개 공지 조회 경로 — permitAll

- **Decision**: `GET /api/announcements`, `GET /api/announcements/{id}` 를 SecurityConfig 에 `.requestMatchers(HttpMethod.GET, "/api/announcements", "/api/announcements/*").permitAll()` 로 공개. 공개 응답은 `isPublished=true` 만 반환.
- **Rationale**: 기존 공개 경로 등록이 `requestMatchers(method, path).permitAll()` 방식(확인됨, 예: `/api/auth/signup/email`). 배너/목록은 인증 불필요. 비공개 공지는 쿼리 단계에서 제외(컨트롤러 권한과 무관).
- **Alternatives considered**: 인증 필요로 두기 — 비로그인 노출 불가·확장성 저하. 공개가 단순·안전(쓰기 없음).

## 3. 어드민 앱 형태 — 모노레포 내 완전한 Next.js 앱

- **Decision**: `admin-site/` 에 독립 `package.json`/`next.config.ts`/`tsconfig.json` 를 둔 **완전한 Next.js 앱**. Vercel 에서 Root Directory=`admin-site`, Production Branch=`main` 인 **신규 프로젝트**로 배포. 백엔드 연결은 본 앱과 동일하게 `next.config` rewrites `/api/:path* → ${BACKEND_ORIGIN}/api/:path*` + 공용 `client.ts`(X-WriteNote-Client 헤더, Result envelope, 401 refresh) 재사용.
- **Rationale**: 사용자 앱과 코드·번들·배포 분리(보안 경계). 기존 `client.ts`/React Query 패턴 그대로 이식 → 학습비용 0. same-origin 프록시로 쿠키/CSRF 정합 유지.
- **정합성 정정(중요)**: 설계 문서의 "download-site 와 판박이"는 **부분적으로만 사실**. `download-site/` 는 `package.json` 없는 **정적 index.html**(빌드 없음)로 확인됨. 어드민 앱은 빌드가 필요한 첫 "두 번째 Next.js 앱". Vercel "별도 프로젝트 + Root Directory" 구조는 동일하나 빌드 파이프라인은 실제 작동. → quickstart/배포 절차에 빌드 단계 명시.
- **Alternatives considered**:
  - 기존 `frontend/` 에 `/admin` 라우트(B안): 번들·배포 결합, 보안 경계 약함 — 기각(설계 확정 A안).
  - 로우코드(Retool 등, C안): 공지/문의 product-facing 미커버 + 외부 SaaS DB 연결 — 기각.
- **차트 라이브러리**: 어드민이 shadcn/ui 사용 → shadcn Charts(recharts 기반)로 30일 가입 추이. 의존성 1개(recharts) 추가. 대안 = CSS/SVG 막대(의존성 0)지만 shadcn 차트가 빠르고 일관.

## 4. 회원 조회 — 비밀값 제외 DTO + 작품 수 집계

- **Decision**: `AdminUserResponse` 에 `id, email, kakaoLinked(Boolean = kakaoId != null), emailVerified(Boolean = emailVerifiedAt != null), lastLoginAt, createdAt, projectCount` 만 포함. `passwordHash`·`kakaoId` 원문·인증 토큰 일절 미포함. 목록은 `createdAt DESC` 페이지네이션(기존 `PageResponse<T>` 패턴), 검색은 email `ILIKE %term%`.
- **Rationale**: FR-010(비밀값 미노출)·SC-006. 기존 페이지네이션/정렬은 `findAllBy...OrderBy...(pageable)` 메서드명 쿼리 패턴 확인됨. 작품 수는 `projects` 카운트(쿼리 1회, N+1 회피 위해 집계 쿼리 또는 배치 카운트).
- **Alternatives considered**: 엔티티 직접 직렬화 — 비밀값 누출 위험, 명시적 DTO 필수.

## 5. 통계 집계 — 기존 데이터 읽기 전용

- **Decision**:
  - `summary`: 총 가입자(`count(users)`), 오늘 신규(`createdAt >= 오늘 00:00 KST`), 이번 주 신규(주 시작 기준), 활성 사용자(`lastLoginAt >= now-7d`, 기본 7일 = spec Assumptions), 총 작품 수(`count(projects)`).
  - `signups?days=30`: 일자별 가입 수 시계열 — `users` 를 가입일(KST) 기준 그룹핑, 결과 없는 날은 0 으로 채워 30개 반환.
  - 모두 `@Transactional(readOnly = true)`.
- **Rationale**: 추가 데이터 수집 없이 기존 `users`/`projects` 집계(US3). 타임존은 KST(`Asia/Seoul`) 기준 일자 경계 — 그래프/“오늘” 정의 일관.
- **Alternatives considered**: 사전 집계 테이블/캐시 — 규모(수천) 대비 과잉. 매 요청 집계로 충분.
- **NEEDS 검증**: "이번 주" 시작(월요일 vs 일요일), "활성" 7일 — 기본값으로 구현, dogfooding 시 사용자 조정 가능(plan-level, 차단 아님).

## 6. 공지 데이터 모델 — Character.kt 패턴

- **Decision**: `Announcement(@Entity, @GeneratedValue(IDENTITY), title, body, isPublished, isPinned, publishedAt, @PrePersist createdAt, @PreUpdate updatedAt)`. FK 없음(독립 테이블). 인덱스: `(is_published, published_at DESC)` 조회 최적화.
- **Rationale**: 기존 엔티티 패턴(IDENTITY, @PrePersist/@PreUpdate) 확인됨. 공지는 어느 작품/유저에도 종속 안 됨 → FK 불필요. data-model.md 에 컬럼·제약 상세.
- **배너 선별**: 배너=최신 공개 공지 1건. `isPinned` 가 있으면 우선(고정 공지), 없으면 `publishedAt DESC` 최신 1건. (FR-004)

## 7. 미확정 항목(기본값 고정, 구현 1단계 전 확정 가능)

| 항목 | 기본값 | 확정 시점 |
|---|---|---|
| 문의 외부 채널 | 이메일 `jongbell4@gmail.com` (mailto) | Phase A 착수 전 |
| 활성 사용자 기준 | 최근 7일 로그인 | dogfooding 조정 |
| 이번 주 시작 | 월요일(ISO) | dogfooding 조정 |
| 어드민 도메인 | `admin.soseolbi.com`(초기 `*.vercel.app` 허용) | Vercel 설정 시 |
