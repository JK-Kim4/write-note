# 2026-07-01 로컬 서비스 QA 리포트

대상: `048-card-management` 브랜치, 현재 로컬 실행 서비스

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- 기준 시각: 2026-07-01 17:30 KST
- 범위: 카드 관리/집필 카드 참조 변경분 중심 + 로컬 서비스 운영성, 인증 경계, 빌드/테스트 게이트
- 제한: 고정 테스트 계정 credential을 확인하지 못해, 로그인 후 실제 dogfooding 데이터 조작 E2E는 수행하지 않았다. 기존 사용자 데이터에 임의 생성/삭제를 하지 않았다.

## 요약

전체 판정: **조건부 통과**

기능 구현 자체는 타입체크, 빌드, 프론트 전체 테스트, 백엔드 전체 테스트를 통과했다. 카드 그룹핑/필터링과 카드 API 소유 격리 테스트도 통과했다. 다만 로컬 서비스 운영/보안 설정에서 즉시 조치할 가치가 있는 문제가 확인됐다.

- P1: `/actuator/health`가 503 DOWN을 반환한다.
- P1: 백엔드 CORS가 설정 파일 allowlist를 무시하고 `Access-Control-Allow-Origin: *`를 반환한다.
- P2: `/actuator/health/liveness`, `/actuator/health/readiness`, `/api/health`, `/actuator/info`가 401이라 모니터링 표면이 불안정하다.
- P2: 집필 카드 뷰는 `GET /api/cards` 전량 조회 후 프론트 필터링이라 카드 수 증가/공유 재사용 시 경계가 약해질 수 있다.
- P3: 프론트 lint 경고 56개가 남아 있다. 신규 카드 상세 파일도 React set-state-in-effect 경고를 포함한다.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|---:|---:|---|
| 1 | Accessibility | 3/4 | 카드 상세는 `inert`/`aria-modal` 적용 확인. 다만 실제 로그인 화면 내부 키보드 E2E는 미수행 |
| 2 | Performance | 3/4 | 빌드/테스트 통과. 카드 뷰 전량 조회는 데이터 증가 시 병목 가능 |
| 3 | Responsive Design | 2/4 | 정적 코드상 대응은 있으나 로그인 후 화면 Playwright 검증 불가. 일부 헤더 버튼은 터치 타깃이 작음 |
| 4 | Theming | 2/4 | Tailwind 색상 직접 사용이 많다. 기존 시스템과는 일치하지만 토큰 기반 완전성은 낮음 |
| 5 | Anti-Patterns | 3/4 | 제품 UI로는 대체로 절제됨. 카드/칩 반복은 기능적 패턴이라 허용 범위 |
| **Total** |  | **13/20** | **Acceptable** |

## Test Cases

| ID | Area | Test case | Expected | Actual | Result |
|---|---|---|---|---|---|
| TC-001 | Runtime | `localhost:3000` 응답 | 앱 응답 또는 인증 라우팅 | `/welcome` 307 redirect | PASS |
| TC-002 | Runtime | `localhost:8080/actuator/health` | 200 UP | 503 DOWN | FAIL |
| TC-003 | Runtime | `localhost:8080/actuator/health/liveness` | 200 공개 liveness | 401 `AUTH_TOKEN_MISSING` | FAIL |
| TC-004 | Runtime | `localhost:8080/actuator/health/readiness` | 200 공개 readiness | 401 `AUTH_TOKEN_MISSING` | FAIL |
| TC-005 | Runtime | `localhost:8080/api/health` | 공개 헬스 응답 | 401 `AUTH_TOKEN_MISSING` | FAIL |
| TC-006 | Security | 비인증 `GET /api/cards` | 401 | 401 `AUTH_TOKEN_MISSING` | PASS |
| TC-007 | Security | 비인증 `POST /api/cards` | 401 | 401 `AUTH_TOKEN_MISSING` | PASS |
| TC-008 | Security | 실패 로그인 응답 | 401, 일반화된 메시지 | 401 `LOGIN_FAILED` | PASS |
| TC-009 | Security | 악성 Origin CORS preflight | allowlist 외 Origin 거부 | `Access-Control-Allow-Origin: *` | FAIL |
| TC-010 | Security | 허용 Origin CORS preflight | 허용 | 200, `Access-Control-Allow-Origin: *` | PARTIAL |
| TC-011 | Security headers | Frontend `/welcome` headers | frame/content/referrer/CSP 존재 | 존재 확인 | PASS |
| TC-012 | Security headers | Backend protected API headers | nosniff/frame/cache 존재 | 존재 확인 | PASS |
| TC-013 | Frontend gate | `npm run typecheck` | exit 0 | exit 0 | PASS |
| TC-014 | Frontend gate | `npm run test` | 전체 테스트 통과 | 99 files / 790 tests pass | PASS |
| TC-015 | Frontend gate | `npm run build` | production build 통과 | Next build success | PASS |
| TC-016 | Frontend lint | `npm run lint` | 0 error | 0 errors, 56 warnings | PASS_WITH_WARNINGS |
| TC-017 | Card FE | `writingCardGroups.test.ts` | 5 tests pass | pass | PASS |
| TC-018 | Card FE | `cardFilter.test.ts` | 6 tests pass | pass | PASS |
| TC-019 | Card FE | `useBoards.test.tsx` | 2 tests pass | pass | PASS |
| TC-020 | Card BE | `CardControllerIT`, `CardServiceTest`, `BoardServiceTest` | selected tests pass | Gradle success | PASS |
| TC-021 | Backend gate | `./gradlew test` | 전체 테스트 통과 | Gradle success | PASS |
| TC-022 | Build artifact | Next route generation | 주요 app route 생성 | 36 static pages + dynamic routes generated | PASS |
| TC-023 | Browser automation | 공개 화면 Playwright desktop/mobile | 콘솔/overflow 확인 | `playwright` package direct resolve 실패 | BLOCKED |
| TC-024 | Auth E2E | 로그인 후 카드 관리/집필 카드 참조 | 실제 UI에서 CRUD/참조 확인 | 테스트 계정 없음, dogfood 데이터 무변경 원칙으로 미수행 | BLOCKED |

## Detailed Findings

### P1. Actuator health가 DOWN

- Location: backend runtime, `/actuator/health`
- Evidence: `curl -i http://localhost:8080/actuator/health` → `HTTP/1.1 503`, body `{"groups":["liveness","readiness"],"status":"DOWN"}`
- Impact: 로컬 dogfooding 중에도 백엔드가 살아 있어 보이지만 readiness 기준으로는 실패한다. 운영 배포 환경에서 헬스 체크, 로드밸런서, 모니터링이 서비스를 비정상으로 판단할 수 있다.
- Recommendation: health detail 원인을 확인하고, liveness/readiness endpoint 접근 정책을 같이 정리한다. `management.endpoint.health.show-details`를 로컬에서만 켜거나 로그로 원인을 확인한다.
- Suggested command: `$impeccable harden`

### P1. CORS allowlist가 무시되고 wildcard로 열림

- Location: `backend/src/main/kotlin/com/writenote/config/CorsConfig.kt:25`
- Evidence:
  - `Origin: http://evil.example` preflight → `HTTP 200`, `Access-Control-Allow-Origin: *`
  - `application-local.yml`과 `application-prod.yml`에는 `app.cors.allowed-origins`가 정의되어 있으나 코드가 읽지 않는다.
- Impact: 현재 httpOnly 쿠키 + `credentials: include` 구조에서는 브라우저가 credentialed cross-origin 응답을 그대로 노출하지 않아 즉시 쿠키 탈취로 이어진다고 단정할 수는 없다. 하지만 백엔드 주석은 localStorage Authorization 전제를 여전히 들고 있고, 실제 프론트는 `frontend/src/lib/api/client.ts:68`에서 쿠키 인증을 사용한다. 보안 설계와 구현이 갈라져 있으며, 향후 Bearer/API token 경로나 운영 환경에서 정책 우회 위험이 커진다.
- Recommendation: `@ConfigurationProperties`로 `app.cors.allowed-origins`를 읽고, 운영은 명시 origin만 허용한다. 현재 인증 방식 기준으로 주석도 갱신한다.
- Suggested command: `$impeccable harden`

### P2. 모니터링 세부 endpoint가 인증에 막힘

- Location: `backend/src/main/kotlin/com/writenote/config/SecurityConfig.kt:70`
- Evidence:
  - `/actuator/health/liveness` → 401
  - `/actuator/health/readiness` → 401
  - `/api/health` → 401
  - `/actuator/info` → 401
- Impact: Spring Boot probes를 켜 둔 상태에서 세부 probe URI를 쓰면 인증 실패로 모니터링이 깨진다. `HealthController`가 있어도 보안 정책상 공개되지 않는다.
- Recommendation: 공개할 모니터링 표면을 하나로 결정한다. 운영에서 필요한 경우 `/actuator/health/**` 또는 최소 `/actuator/health/liveness`, `/actuator/health/readiness`를 permit 한다.
- Suggested command: `$impeccable harden`

### P2. 집필 카드 뷰가 전체 카드 목록을 가져온 뒤 클라이언트에서 필터링

- Location:
  - `frontend/src/components/b/WritingCardView.tsx:28`
  - `frontend/src/components/b/writingCardGroups.ts:36`
- Evidence: `useCardList(active)`가 전체 카드 목록을 조회하고, `boardId`와 참조 보드 id를 프론트에서 결합한다.
- Impact: 현재 스펙과는 일치하고 사용자 스코프도 백엔드에서 보호된다. 다만 카드가 많아질수록 집필 화면에서 무관 카드 본문까지 모두 내려받고 메모리에 올린다. 공유/협업/읽기 전용 화면에서 재사용되면 데이터 경계가 애매해질 수 있다.
- Recommendation: 단기적으로는 유지 가능. 카드 수가 늘거나 공유 재사용 가능성이 생기면 `GET /api/cards?projectId=` 또는 전용 reference-card API로 서버 필터링한다.
- Suggested command: `$impeccable optimize`

### P3. Lint 경고가 누적되어 회귀 신호 품질이 낮음

- Location: frontend lint output
- Evidence: `npm run lint` → `0 errors, 56 warnings`
- Impact: 실제 에러는 없지만 warnings가 많아 새 경고를 놓치기 쉽다. 신규 `WritingCardDetail.tsx`도 `setState in effect` 경고를 포함한다.
- Recommendation: 별도 정리 이슈로 warnings를 줄이거나, 최소 신규 변경 파일의 warnings부터 제거한다.
- Suggested command: `$impeccable polish`

### P3. 패널 헤더 버튼 터치 타깃이 작을 수 있음

- Location: `frontend/src/components/b/BoardReferencePanel.tsx:197`
- Evidence: `px-2 py-1 text-xs` 버튼들이 패널 상단에 배치된다.
- Impact: 데스크톱에서는 문제 가능성이 낮지만, 태블릿/모바일 폭에서 손가락 조작 기준 44px 터치 타깃에 못 미칠 수 있다.
- Recommendation: 작은 아이콘형 버튼은 `min-h-9` 또는 `min-h-10`, `min-w-9`를 부여하고 hover/focus 스타일을 유지한다.
- Suggested command: `$impeccable adapt`

## Positive Findings

- 카드 관련 핵심 테스트가 존재한다. `writingCardGroups.test.ts`는 그룹 순서, 무관 카드 제외, 정렬, 독립 카드 케이스, 입력 불변성을 검증한다.
- 백엔드 카드 API는 비인증 요청을 401로 막고, 전체 백엔드 테스트가 통과했다.
- 프론트 production build가 성공했고, Next route 생성도 완료됐다.
- 카드 상세 오버레이는 현재 작업트리 기준 `inert`와 `aria-modal`을 적용해 닫힌 다이얼로그의 접근성 문제를 완화하고 있다.
- 프론트 보안 헤더(`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `CSP`)가 로컬 응답에 포함된다.

## Recommended Actions

1. **[P1] `$impeccable harden`**: actuator health DOWN 원인과 health endpoint 접근 정책 정리.
2. **[P1] `$impeccable harden`**: CORS wildcard 제거, `app.cors.allowed-origins` 실제 반영, 인증 방식 주석 정리.
3. **[P2] `$impeccable optimize`**: 카드 참조 뷰 전량 조회를 서버 필터링으로 전환할지 판단.
4. **[P3] `$impeccable adapt`**: 패널 헤더 버튼 터치 타깃 보강.
5. **[P3] `$impeccable polish`**: lint warnings 감소, 특히 신규/변경 파일 우선.

## Verification Log

```text
curl -i http://localhost:8080/actuator/health
=> HTTP/1.1 503, status DOWN

curl -i http://localhost:8080/api/cards
=> HTTP/1.1 401, AUTH_TOKEN_MISSING

curl -i -X OPTIONS -H 'Origin: http://evil.example' -H 'Access-Control-Request-Method: GET' http://localhost:8080/api/cards
=> HTTP/1.1 200, Access-Control-Allow-Origin: *

npm run typecheck
=> exit 0

npm run test
=> 99 files passed, 790 tests passed

npm run build
=> Compiled successfully, route generation completed

npm run lint
=> 0 errors, 56 warnings

./gradlew test
=> BUILD SUCCESSFUL
```

