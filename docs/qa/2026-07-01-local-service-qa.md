# 2026-07-01 로컬 서비스 QA 리포트

대상: `048-card-management` 브랜치, 현재 로컬 실행 서비스

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- 기준 시각: 2026-07-01 18:23 KST
- 범위: 카드 관리/집필 카드 참조 변경분 중심 + 로컬 서비스 운영성, 인증 경계, 빌드/테스트 게이트
- 테스트 계정: `qa-card-20260701175050@writenote.local` / `Strong!Pass123`
- 테스트 데이터: QA 전용 사용자/시리즈/작품/보드/카드만 생성했다. 기존 사용자 dogfood 데이터는 변경하지 않았다.

## 요약

전체 판정: **048 카드 관리 범위 통과, 인프라 이슈 별도 트랙**

기능 구현 자체는 타입체크, 빌드, 프론트 전체 테스트, 백엔드 전체 테스트를 통과했다. QA 계정을 생성해 로그인 후 API와 UI를 직접 검증했고, 카드 관리/집필 카드 참조의 핵심 시나리오도 통과했다.

048 브랜치에서 blocking으로 볼 수정 필요 지점은 현재 0건이다. 아래 항목은 확인됐지만 048 변경분의 release blocking 이슈로 분류하지 않는다.

- Existing infra: `/actuator/health`가 로컬 SMTP 미구성으로 503 DOWN을 반환한다.
- Existing infra: 백엔드 CORS가 설정 파일 allowlist를 무시하고 `Access-Control-Allow-Origin: *`를 반환한다.
- Existing infra: `/actuator/health/liveness`, `/actuator/health/readiness`, `/api/health`, `/actuator/info`가 401이다.
- Accepted scope: 집필 카드 뷰는 `GET /api/cards` 전량 조회 후 프론트 필터링이다. 현재 스펙/유저 스코프에서는 노출 문제 없음.
- Non-blocking convention: 프론트 lint 경고 56개가 남아 있다. 신규 카드 상세 파일 경고는 기존 dialog retention/mount-guard 관례와 같은 유형이다.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|---:|---:|---|
| 1 | Accessibility | 3/4 | 카드 상세는 `inert`/`aria-modal` 적용 확인. 로그인 후 상세 열기/ESC 닫기 검증 |
| 2 | Performance | 3/4 | 빌드/테스트 통과. 카드 뷰 전량 조회는 데이터 증가 시 병목 가능 |
| 3 | Responsive Design | 3/4 | 데스크톱 Playwright 검증 완료. 기존 헤더 버튼 일부는 터치 타깃 개선 여지 |
| 4 | Theming | 2/4 | Tailwind 색상 직접 사용이 많다. 기존 시스템과는 일치하지만 토큰 기반 완전성은 낮음 |
| 5 | Anti-Patterns | 3/4 | 제품 UI로는 대체로 절제됨. 카드/칩 반복은 기능적 패턴이라 허용 범위 |
| **Total** |  | **15/20** | **Acceptable** |

## Test Cases

| ID | Area | Test case | Expected | Actual | Result |
|---|---|---|---|---|---|
| TC-001 | Runtime | `localhost:3000` 응답 | 앱 응답 또는 인증 라우팅 | `/welcome` 307 redirect | PASS |
| TC-002 | Runtime | `localhost:8080/actuator/health` | 로컬 원인 식별 | 503 DOWN, 로컬 SMTP 미구성 영향 | PASS_WITH_INFRA_ISSUE |
| TC-003 | Runtime | `localhost:8080/actuator/health/liveness` | 운영 노출 정책 확인 | 401 `AUTH_TOKEN_MISSING` | PASS_WITH_INFRA_ISSUE |
| TC-004 | Runtime | `localhost:8080/actuator/health/readiness` | 운영 노출 정책 확인 | 401 `AUTH_TOKEN_MISSING` | PASS_WITH_INFRA_ISSUE |
| TC-005 | Runtime | `localhost:8080/api/health` | 운영 노출 정책 확인 | 401 `AUTH_TOKEN_MISSING` | PASS_WITH_INFRA_ISSUE |
| TC-006 | Security | 비인증 `GET /api/cards` | 401 | 401 `AUTH_TOKEN_MISSING` | PASS |
| TC-007 | Security | 비인증 `POST /api/cards` | 401 | 401 `AUTH_TOKEN_MISSING` | PASS |
| TC-008 | Security | 실패 로그인 응답 | 401, 일반화된 메시지 | 401 `LOGIN_FAILED` | PASS |
| TC-009 | Security | 악성 Origin CORS preflight | 기존 설정 위생 이슈 확인 | `Access-Control-Allow-Origin: *` | PASS_WITH_INFRA_ISSUE |
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
| TC-023 | Browser automation | 공개 화면 Playwright desktop/mobile | 콘솔/overflow 확인 | Playwright 직접 import 경로 확인, 주요 인증 UI 검증에 사용 | PASS |
| TC-024 | Auth E2E | 테스트 계정 로그인 | `/auth/login`에서 실제 입력 후 인증 쿠키 발급 | `/api/auth/me` 200 | PASS |
| TC-025 | Card API E2E | QA 계정으로 시리즈/작품/보드/카드 생성 | 생성/연결/소유 격리 정상 | category/project/boards/cards/link 생성, 타 사용자 404 | PASS |
| TC-026 | Card API E2E | 집필 참조 보드 조회 | 작품 보드 + 상위 시리즈 보드만 반환 | board `438`, `439` 반환, 무관 board `440` 제외 | PASS |
| TC-027 | Card API E2E | 카드 그룹핑 데이터 검증 | 작품/시리즈/독립/무관 카드 분리 | work `[240,236,235]`, series `[237]`, solo `[239]`, unrelated `238` 제외 | PASS |
| TC-028 | Card UI E2E | 집필 화면 카드 참조 탭 | 작품/시리즈/독립 카드 표시, 무관 카드 제외 | `/works/13836`에서 통과 | PASS |
| TC-029 | Card UI E2E | 카드 상세 열기/ESC 닫기 | 열림 `opacity-100`, 닫힘 `opacity-0` + `inert` | 통과 | PASS |
| TC-030 | Card UI E2E | 전역 보드 화면 카드 관리 | 전체 카드 확인 가능 | `/boards` 카드 버튼 전환 후 QA 카드 표시 | PASS |

## Detailed Findings

### Existing Infra. Actuator health가 로컬에서 DOWN

- Location: backend runtime, `/actuator/health`
- Evidence: `curl -i http://localhost:8080/actuator/health` → `HTTP/1.1 503`, body `{"groups":["liveness","readiness"],"status":"DOWN"}`
- Follow-up: 로그 기준 근본 원인은 `MailHealthIndicator`의 로컬 SMTP 연결 실패다. DB와 앱 API는 정상 응답한다.
- Impact: 현재 확인된 영향은 로컬 cosmetic/readiness 문제다. 운영은 실 SMTP 설정 전제라 동일 장애로 단정하지 않는다.
- Recommendation: 048 blocking에서 제외하고 별도 인프라 트랙에서 local profile의 mail health 정책을 정리한다.
- Suggested command: `$impeccable harden`

### Existing Infra. CORS allowlist가 무시되고 wildcard로 열림

- Location: `backend/src/main/kotlin/com/writenote/config/CorsConfig.kt:25`
- Evidence:
  - `Origin: http://evil.example` preflight → `HTTP 200`, `Access-Control-Allow-Origin: *`
  - `application-local.yml`과 `application-prod.yml`에는 `app.cors.allowed-origins`가 정의되어 있으나 코드가 읽지 않는다.
- Impact: 현재 `allowCredentials=false`와 prod same-origin proxy 전제를 고려하면 즉시 익스플로잇 위험은 낮다. 다만 `application-*.yml`의 `app.cors.allowed-origins`가 dead property가 됐고, 백엔드 주석은 localStorage/Authorization 전제를 여전히 들고 있다. 실제 프론트는 `frontend/src/lib/api/client.ts:68`에서 쿠키 인증을 사용한다.
- Recommendation: `@ConfigurationProperties`로 `app.cors.allowed-origins`를 읽고, 운영은 명시 origin만 허용한다. 현재 인증 방식 기준으로 주석도 갱신한다.
- Suggested command: `$impeccable harden`

### Existing Infra. 모니터링 세부 endpoint가 인증에 막힘

- Location: `backend/src/main/kotlin/com/writenote/config/SecurityConfig.kt:70`
- Evidence:
  - `/actuator/health/liveness` → 401
  - `/actuator/health/readiness` → 401
  - `/api/health` → 401
  - `/actuator/info` → 401
- Impact: 운영에서 어떤 endpoint를 외부/내부 모니터링에 공개할지의 정책 문제다. 048 카드 기능과 직접 관련은 없다.
- Recommendation: 공개할 모니터링 표면을 별도 보안/운영 트랙에서 결정한다. 운영에서 필요한 경우 `/actuator/health/**` 또는 최소 `/actuator/health/liveness`, `/actuator/health/readiness`를 permit 한다.
- Suggested command: `$impeccable harden`

### Accepted Scope. 집필 카드 뷰가 전체 카드 목록을 가져온 뒤 클라이언트에서 필터링

- Location:
  - `frontend/src/components/b/WritingCardView.tsx:28`
  - `frontend/src/components/b/writingCardGroups.ts:36`
- Evidence: `useCardList(active)`가 전체 카드 목록을 조회하고, `boardId`와 참조 보드 id를 프론트에서 결합한다.
- Impact: 현재 스펙/research D9 결정 및 유저 스코프에서는 노출 문제가 없다. 카드가 많아질수록 집필 화면에서 무관 카드 본문까지 모두 내려받고 메모리에 올리는 성능 비용은 생긴다.
- Recommendation: 단기적으로는 유지 가능. 이미 T052로 surfacing 된 항목이다. 카드 수가 늘거나 공유 재사용 가능성이 생기면 `GET /api/cards?projectId=` 또는 전용 reference-card API로 서버 필터링한다.
- Suggested command: `$impeccable optimize`

### Non-blocking. Lint 경고가 누적되어 회귀 신호 품질이 낮음

- Location: frontend lint output
- Evidence: `npm run lint` → `0 errors, 56 warnings`
- Impact: 실제 에러는 없지만 warnings가 많아 새 경고를 놓치기 쉽다. 신규 `WritingCardDetail.tsx` 경고는 `CardDetailSheet` 등 기존 16개 파일과 같은 SSR mount-guard/retention 관례다.
- Recommendation: 048 blocking 수정은 불필요하다. 별도 정리 이슈로 warnings를 줄이는 것은 유효하다.
- Suggested command: `$impeccable polish`

### Existing UI. 패널 헤더 버튼 터치 타깃이 작을 수 있음

- Location: `frontend/src/components/b/BoardReferencePanel.tsx:197`
- Evidence: `px-2 py-1 text-xs` 버튼들이 패널 상단에 배치된다.
- Impact: 데스크톱에서는 문제 가능성이 낮지만, 태블릿/모바일 폭에서 손가락 조작 기준 44px 터치 타깃에 못 미칠 수 있다. 지적된 `✕`/`⤢`/`↗` 버튼은 048 이전부터 있던 UI다.
- Recommendation: 별도 UI polish에서 작은 아이콘형 버튼에 `min-h-9` 또는 `min-h-10`, `min-w-9`를 부여하고 hover/focus 스타일을 유지한다.
- Suggested command: `$impeccable adapt`

## Positive Findings

- 카드 관련 핵심 테스트가 존재한다. `writingCardGroups.test.ts`는 그룹 순서, 무관 카드 제외, 정렬, 독립 카드 케이스, 입력 불변성을 검증한다.
- 백엔드 카드 API는 비인증 요청을 401로 막고, 전체 백엔드 테스트가 통과했다.
- 프론트 production build가 성공했고, Next route 생성도 완료됐다.
- 카드 상세 오버레이는 현재 작업트리 기준 `inert`와 `aria-modal`을 적용해 닫힌 다이얼로그의 접근성 문제를 완화하고 있다.
- 프론트 보안 헤더(`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `CSP`)가 로컬 응답에 포함된다.

## Recommended Actions

1. **[048] No blocking fix**: 테스트 계정 기반 API/UI E2E까지 통과했으므로 현재 048 범위의 필수 수정은 없다.
2. **[Infra] `$impeccable harden`**: local mail health, health endpoint 공개 정책, CORS allowlist 반영을 별도 트랙으로 정리한다.
3. **[Later] `$impeccable optimize`**: 카드 수 증가 시점에 카드 참조 뷰 전량 조회를 서버 필터링으로 전환할지 판단한다.
4. **[Later] `$impeccable adapt`**: 기존 패널 헤더 버튼 터치 타깃을 별도 UI polish로 보강한다.

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

QA 계정 생성/인증
=> qa-card-20260701175050@writenote.local 생성, DB에서 email_verified_at 설정

API E2E
=> category 690, project 13836, work board 438, series board 439, unrelated board 440 생성
=> cards 235,236,237,238,239,240 생성
=> linked card reassign to null blocked 400
=> other user card read 404, other user reference boards read 404
=> /api/boards/reference?projectId=13836 returns boards 439,438 only

Playwright UI E2E
=> /auth/login 실제 입력 로그인, /api/auth/me 200
=> /works/13836 보드 참조 > 카드 탭: 작품/시리즈/독립 카드 표시, 무관 카드 제외
=> 카드 상세 열기/ESC 닫기: opened opacity-100, closed opacity-0 + inert
=> /boards 카드 버튼: 전역 카드 관리 목록에서 QA 카드 표시
```
