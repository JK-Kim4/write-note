# 회고 — 005 Phase 2 Frontend Views & Auth Integration

**일자:** 2026-05-30
**브랜치:** `005-phase-2-frontend-views`
**범위:** MVP(US1) 사용자 검증 통과 → US2~US6 전부 frontend 구현 + R1 인증 httpOnly 쿠키 전환(backend). 자동화 49/55 task + Polish 3 (T051/T054 직접점검 + T055 회고 잔여).

---

## 1. 무엇을 했나

- **R1 인증 쿠키 전환**: 헤더 기반 JWT → httpOnly 쿠키. backend `AuthCookieFactory` / `JwtAuthenticationFilter` 쿠키 read 병존(헤더 우선 — 003 회귀 보존) / `AuthController` Set-Cookie + **refresh·logout 쿠키 fallback** / `OAuth2SuccessHandler` 쿠키화 + 홈 redirect. frontend same-origin 프록시(next rewrites) + `client.ts` swap(credentials:include + 401 reactive refresh) + `authPlaceholder` 폐기 + `/me` 가드.
- **US1~US6**: 로그인+홈 / 새 프로젝트 / 메타카드·편집·생명주기 / 등장인물 CRUD·reorder / 가입·이메일인증·재설정 / 카카오.
- **backend 메일 링크 frontend 라우트 재설계**(LoggingMailSender) — US5 인증 흐름 정합.
- **Polish**: 에러 code 한국어 매핑 공통화 / SC-008 0건 / 전체 게이트 GREEN.

## 2. 어떻게 했나

- speckit 산출물(spec/plan/research/contracts) 기반, HANDOFF.md로 세션 인수.
- 사용자 합의 = MVP(R1+US1) 먼저 → 직접 검증 통과 후 US2~US6 진행.
- 각 US 단위로 frontend 게이트(lint/typecheck/test/build) — RSC 경계 + Suspense 경계 build 검출.
- backend는 라운드 종료 시 전체 게이트(003/004 회귀 GREEN 유지).
- US별 논리 단위 커밋 6종.

## 3. 잘된 점

- **MVP 우선 + 사용자 직접 검증** 후 나머지 진행 — 핵심 흐름(로그인→홈→세션 유지)을 일찍 실증.
- **003 헤더 회귀 보존**: 쿠키 read 병존(헤더 우선)으로 기존 80+ 테스트 GREEN 유지.
- **본질 결정 추측 금지**: refresh 쿠키 fallback / US5 메일 링크 흐름은 추측 대신 사용자 정렬 후 진행.
- 테스트 17건(인증·프로젝트·등장인물 핵심 행위) + 양쪽 게이트로 회귀 차단.

## 4. 어긋난 점 (회귀/설계 갭)

1. **T011 OAuth2SuccessHandler 쿠키화 시 `AuthOauthCallbackWebTest` 회귀** — T001 기준선에서 이 테스트를 "헤더 GREEN 유지 대상 7종"으로 분류한 추측이 어긋남. 이 통합 테스트는 fragment redirect 동작을 직접 검증하므로 쿠키화하면 깨질 수밖에 없었고, T011 시점에 함께 갱신했어야 함. 전체 게이트(T013)에서 뒤늦게 발견.
2. **refresh·logout 쿠키 fallback 누락** — contract(auth-cookie-contract §3)가 "body 우선 + 쿠키 fallback 허용(R1 구현 시 확정)"으로 남긴 영역을 R1 backend(T009)에서 미구현. frontend reactive refresh(T015) 구현 직전, httpOnly 쿠키라 JS가 refresh token을 body에 못 넣는다는 점에서 발견 → backend 보완(사용자 컨펌).
3. **jsdom 29 Node 20.10 비호환** — 첫 실제 테스트에서 `html-encoding-sniffer@6` ESM require 실패. jsdom 26으로 다운그레이드(ISSUE-016 연장). frontend 도구 chain 전반이 Node 20.10 `require(ESM)` 미지원에 묶임.
4. **backend 메일 인증/재설정 링크 ↔ frontend 라우트 불일치** — 링크가 POST API endpoint(`/api/auth/verify-email?token=`)를 GET 링크로 가리켜 frontend 라우트와 안 맞음. spec은 "인증 완료"만 정의, 링크 흐름 미정의 → US5 진입 시 설계 갭으로 surfacing, frontend 라우트로 재설계.

## 5. 교훈 / 룰 갱신 후보 (사용자 컨펌 영역)

- **(회귀 1·2 공통)** contract/기준선이 "구현 시 확정" 또는 "GREEN 유지 대상"으로 남긴 항목은 **추측이며, 해당 동작을 실제로 바꾸는 task 진입 직전 재검증** 대상. → `agent-workflow-discipline §6`에 "기준선 분류(GREEN 유지 대상)도 동작 변경 task 진입 시 재확인" 보강 후보.
- **(회귀 3)** frontend 도구 chain의 Node 런타임 호환을 plan/research 단계에서 검증 — 이미 ISSUE-016 룰 갱신 후보로 박힘(`node --version` + 도구 peer 매트릭스). jsdom까지 동일 패턴 재발 → 후보 강화.
- **(회귀 4)** spec이 "동작 완료"만 정의하고 **링크/리다이렉트 URL 흐름을 미정의**한 경우, frontend 라우트 ↔ backend redirect/메일 URL 정합을 plan contracts에 명시. → contracts 작성 시 "외부에서 진입하는 URL(메일·OAuth 콜백)의 도착 라우트" 체크리스트 후보.

> 룰 파일 실제 수정은 사용자 컨펌 후. 본 회고는 후보 surfacing까지.

## 6. 남은 것

- **T051 / T054**: 신규 화면 5종 라이트/다크 + quickstart §3 전체 — 사용자 브라우저 직접점검(카카오는 외부 인가 제약).
- backend 서버는 메일 링크 변경 전 코드로 떠 있어, 이메일/재설정 흐름 점검 전 재시작 필요.
