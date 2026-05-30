# Feature Specification: 005 Phase 2 Frontend Views & Auth Integration

**Feature Branch**: `005-phase-2-frontend-views`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "005 Phase 2 Frontend Views — wireframe 기반 프론트엔드 화면 4종 (홈 / 새 프로젝트 만들기 / 프로젝트 메타 카드 / 등장인물 관리) 구현 + 004 백엔드 Project·Character CRUD 연동 + ISSUE-015 (frontend↔backend 인증 contract drift — client.ts 가 임시 X-User-Id 헤더를 보내는데 003 backend 가 JWT 인증으로 교체됨) 해소."

> **결정 요약 (2026-05-28 사용자 인터뷰 확정).** 본 spec 진입 전 3가지 본질 결정을 확정했다.
> 1. **인증 범위** = 인증 전체 동작 (이메일 로그인 + 회원가입/이메일 인증 + 카카오 OAuth + 비밀번호 재설정 모두 실동작).
> 2. **세션 토큰 저장** = httpOnly 쿠키. 현재 backend(003)는 토큰을 응답 body 로 반환 + `Authorization: Bearer` 헤더로 인증하므로, 쿠키 방식은 **backend 인증 재작업을 동반**한다 (Set-Cookie 발급 / 인증 필터 쿠키 read / CSRF 보호 / 카카오 콜백 흐름 변경). frontend↔backend 는 **same-origin 프록시**로 묶어 cross-site 쿠키 제약과 CORS 를 회피한다 (Clarifications 2026-05-28). → 005 는 frontend-only 가 아니라 **frontend + backend 혼합 phase**.
> 3. **화면 형태** = 별도 페이지 (새 프로젝트 = `/projects/new`, 메타 편집 = 전용 편집 페이지). 메타 카드는 `/projects/{id}` 에 표시. `docs/plan/01-phase-breakdown.md §5 Phase 2-4~2-7` 라우트 명시 그대로.

---

## Clarifications

### Session 2026-05-28

- Q: httpOnly 쿠키 인증의 환경별 전략 (cross-site 배포 vs same-site 로컬) → A: **same-origin 프록시** — frontend 가 `/api` 요청을 같은 출처로 프록시(Next.js / Vercel rewrites)해 backend 를 같은 도메인 뒤에 둔다. 브라우저 입장에서 항상 same-origin → 쿠키 SameSite=Lax 통일, CORS(교차 출처 설정) 불필요, CSRF(요청 위조) 위험 구조적 완화. (구체 rewrites 구성·Next.js 16 동작은 plan/research 검증)

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 로그인하여 내 프로젝트 목록 보기 (Priority: P1)

기존 사용자가 이메일·비밀번호로 로그인하면 세션이 발급되고, 홈 화면에서 본인 프로젝트 목록(또는 비어 있으면 환영 화면)을 본다. 새로고침하거나 탭을 닫았다 다시 열어도 로그인 상태가 유지된다.

**Why this priority**: 모든 데이터 화면(프로젝트·등장인물)이 인증된 세션을 전제로 한다. 인증 통합과 홈 목록 조회가 없으면 005 의 나머지는 동작 자체가 불가능하다(현재 임시 `X-User-Id` 헤더로는 backend 가 401 — ISSUE-015). 이 스토리 하나만으로도 "로그인 → 내 작업공간 진입"이라는 viable MVP slice 가 성립한다. backend 인증 쿠키 전환(Set-Cookie / 필터 쿠키 read / CORS / CSRF)은 이 스토리의 foundational 작업으로 포함한다.

**Independent Test**: 가입·인증 완료된 계정으로 로그인 폼을 제출 → 홈으로 이동 → 본인 프로젝트 목록(또는 빈 상태)이 표시되는지 확인. 브라우저 새로고침 후 재로그인 없이 목록이 유지되는지 확인. 002 dogfooding T051(홈 placeholder query)이 GREEN 인지 재검증.

**Acceptance Scenarios**:

1. **Given** 가입·이메일 인증 완료된 계정, **When** 올바른 이메일·비밀번호로 로그인, **Then** 세션 쿠키가 발급되고 홈으로 이동하여 본인 프로젝트 목록이 표시된다.
2. **Given** 프로젝트가 0개인 계정, **When** 로그인 후 홈 진입, **Then** 빈 상태(H0) hero + "첫 프로젝트 만들기" CTA 가 표시된다.
3. **Given** 로그인 상태, **When** 브라우저 새로고침 또는 탭 재개, **Then** 재로그인 없이 세션이 유지되어 목록이 그대로 보인다.
4. **Given** 비로그인 상태, **When** 홈(또는 임의 보호 화면) 직접 접근, **Then** 데이터가 노출되지 않고 로그인 화면으로 안내된다.
5. **Given** access token 만료, **When** 보호 API 요청 발생, **Then** 자동으로 세션이 갱신(refresh)되어 사용자 개입 없이 요청이 성공한다. 갱신 실패 시 로그인 화면으로 안내된다.
6. **Given** 잘못된 비밀번호 5회 또는 미인증 이메일, **When** 로그인 시도, **Then** 잠금/미인증에 해당하는 안내 메시지가 표시된다.

---

### User Story 2 - 새 프로젝트 만들기 (Priority: P2)

작가가 홈의 CTA 또는 버튼에서 새 프로젝트 만들기 화면으로 진입해, 제목(필수)과 메타 정보(장르·목표 분량·톤 노트·시놉시스·세계관 메모, 모두 선택)를 입력하고 프로젝트를 생성한다. 생성 직후 해당 프로젝트 화면으로 이동한다.

**Why this priority**: 빈 작업공간에서 가장 먼저 필요한 액션. 홈(US1)에 진입한 사용자가 실제로 작업을 시작하려면 프로젝트 생성이 첫 관문이다. 빈 홈의 CTA 가 향하는 목적지.

**Independent Test**: 홈에서 "새 프로젝트 만들기" 진입 → 제목 입력 후 생성 → 새 프로젝트가 목록/상세에 나타나는지 확인. 제목 누락 시 검증 메시지 확인.

**Acceptance Scenarios**:

1. **Given** 로그인 상태, **When** `/projects/new` 에서 제목만 입력하고 생성, **Then** 프로젝트가 생성되고 해당 프로젝트 화면으로 이동한다.
2. **Given** 새 프로젝트 폼, **When** 제목 + 메타 5필드 일부를 입력하고 생성, **Then** 입력한 메타가 반영된 프로젝트가 생성된다.
3. **Given** 새 프로젝트 폼, **When** 제목을 비우고 제출, **Then** 폼에 검증 오류가 표시되고 생성되지 않는다.

---

### User Story 3 - 프로젝트 메타 카드 보기 + 편집 + 생명주기 (Priority: P3)

작가가 프로젝트 화면(`/projects/{id}`)에서 메타 카드(제목·장르·목표 분량·톤 노트·시놉시스·세계관 메모)를 항상 볼 수 있고, 전용 편집 페이지에서 부분 수정한다. 프로젝트를 보관/보관 해제하거나 영구 삭제할 수 있다.

**Why this priority**: 메타 카드는 DESIGN.md 가 말하는 "영원히 살아있는 진실" — 작업의 컨텍스트 닻. 생성(US2) 이후 프로젝트를 다듬고 관리하는 흐름. 편집·생명주기는 목록·생성보다 후순위지만 V1 작업공간 완결에 필요하다.

**Independent Test**: 프로젝트 화면에서 메타 카드 표시 확인 → 편집 페이지에서 일부 필드 수정 후 저장 → 변경 반영 확인. 보관 → 활성 목록에서 사라지고 보관함에 나타남 확인. 삭제 → 확인 후 목록에서 제거 확인.

**Acceptance Scenarios**:

1. **Given** 프로젝트 1개, **When** `/projects/{id}` 진입, **Then** 메타 카드에 입력된 필드가 표시되고 빈 필드는 비어 있음을 알 수 있다.
2. **Given** 메타 편집 페이지, **When** 일부 필드만 수정 후 저장, **Then** 수정한 필드만 갱신되고 나머지는 유지된다.
3. **Given** 활성 프로젝트, **When** 보관, **Then** 활성 목록에서 사라지고 보관함 목록에 나타난다. 보관 해제 시 반대로 동작한다.
4. **Given** 프로젝트, **When** 영구 삭제 확인, **Then** 목록에서 제거되고 해당 프로젝트의 등장인물도 함께 사라진다.

---

### User Story 4 - 등장인물 관리 (Priority: P4)

작가가 프로젝트의 등장인물 페이지(`/projects/{id}/characters`)에서 인물 목록을 표시 순서대로 보고, 인물을 추가/편집/삭제하고, 표시 순서를 재정렬한다.

**Why this priority**: 등장인물은 프로젝트 메타의 일부지만 독립 관리 화면이 필요한 영역. 메타 카드(US3) 이후의 세부 관리. V1 작업공간의 마지막 데이터 화면.

**Independent Test**: 등장인물 페이지에서 인물 추가 → 목록에 표시 확인 → 편집/삭제 동작 확인 → 순서 재정렬 후 새로고침해도 순서 유지 확인.

**Acceptance Scenarios**:

1. **Given** 등장인물 페이지, **When** 이름(필수) + 한 줄 설명/노트 입력 후 추가, **Then** 인물이 목록 끝에 표시된다.
2. **Given** 인물 목록, **When** 한 인물의 정보를 수정, **Then** 변경이 반영된다.
3. **Given** 인물 2명 이상, **When** 순서를 재정렬, **Then** 새 순서가 저장되고 새로고침 후에도 유지된다.
4. **Given** 인물, **When** 삭제, **Then** 목록에서 제거된다.

---

### User Story 5 - 회원가입 · 이메일 인증 · 비밀번호 재설정 (Priority: P5)

신규 사용자가 이메일·비밀번호로 가입하고 이메일 인증을 완료한다. 비밀번호를 잊은 사용자가 재설정(요청 → 메일 → 새 비밀번호 → 완료) 흐름을 완료한다.

**Why this priority**: 인증 전체 동작(사용자 결정)의 일부이나, 데이터 화면 진입의 전제는 이메일 로그인(US1)이고 본인 계정은 이미 존재하므로 후순위. 신규 사용자 온보딩과 비밀번호 분실 복구를 완결한다.

**Independent Test**: 신규 이메일로 가입 → 인증 메일 토큰으로 인증 완료 → 로그인 가능 확인. 가입 계정으로 비밀번호 재설정 요청 → 토큰으로 새 비밀번호 설정 → 새 비밀번호로 로그인 확인.

**Acceptance Scenarios**:

1. **Given** 미가입 이메일, **When** 회원가입 폼 제출, **Then** 계정이 생성되고 인증 메일 발송 안내가 표시된다.
2. **Given** 인증 토큰, **When** 이메일 인증 완료, **Then** 해당 계정으로 로그인이 가능해진다.
3. **Given** 가입 계정, **When** 비밀번호 재설정 4단계 완료, **Then** 새 비밀번호로 로그인할 수 있다.

---

### User Story 6 - 카카오 로그인 · 추가 연결 (Priority: P6)

사용자가 카카오 계정으로 로그인한다. 이메일 가입자가 본인 계정에 카카오를 추가 연결한다.

**Why this priority**: 인증 전체 동작의 마지막 조각. 카카오 콜백을 쿠키 세션 발급 방식으로 전환해야 하므로 backend 변경을 동반한다. 편의 로그인 수단으로, 이메일 로그인이 동작하는 한 V1 필수 진입 경로는 아니므로 최후순위.

**Independent Test**: 카카오 로그인 버튼 → 카카오 인가 → 콜백 후 세션 쿠키 발급 + 홈 진입 확인. 이메일 로그인 상태에서 카카오 추가 연결 → 본인 정보에 카카오 연결 반영 확인.

**Acceptance Scenarios**:

1. **Given** 카카오 계정, **When** 카카오 로그인 완료, **Then** 세션 쿠키가 발급되고 홈으로 진입한다.
2. **Given** 이메일 로그인 상태, **When** 카카오 추가 연결, **Then** 본인 계정에 카카오가 연결된다.
3. **Given** 이미 다른 계정에 묶인 카카오 식별자, **When** 연결 시도, **Then** 충돌 안내가 표시되고 본인 계정은 변경되지 않는다.

---

### Edge Cases

- **세션 만료 도중 작업**: 폼 작성 중 access token 이 만료되면 자동 refresh 후 제출이 성공해야 한다. refresh 도 만료/무효면 입력 손실을 최소화하며 로그인으로 안내한다.
- **CSRF 토큰 누락/불일치**: 쓰기 요청에 CSRF 보호가 적용된 상태에서 토큰 누락 시 요청이 거부되고 사용자에게 재시도를 안내한다.
- **타 사용자 리소스 접근**: 본인 소유가 아닌 `projectId`/`characterId` 직접 URL 접근 시 존재 여부를 노출하지 않고(404) 적절히 안내한다.
- **빈 등장인물 재정렬**: 인물 0명 프로젝트에서 재정렬은 no-op.
- **재정렬 검증 실패**: 전체 인물 ID 의 누락/중복/외부 ID 가 섞이면 순서 변경이 거부되고 안내된다.
- **카카오 콜백 충돌**: 이메일 가입자가 비로그인 상태에서 카카오 로그인 시도 시(이미 같은 이메일 존재) 충돌 화면으로 안내된다.
- **삭제 확인**: 프로젝트 영구 삭제는 되돌릴 수 없으므로 사용자 확인 후에만 수행한다.
- **네트워크 실패**: API 요청 실패 시 화면이 깨지지 않고 재시도 가능한 에러 상태를 표시한다.

## Requirements *(mandatory)*

### Functional Requirements

#### 인증 통합 (Auth — US1/US5/US6, ISSUE-015)

- **FR-001**: 사용자는 이메일·비밀번호로 로그인할 수 있어야 한다.
- **FR-002**: 로그인 성공 시 세션 토큰(access/refresh)이 httpOnly 쿠키로 발급되어 브라우저에 저장되어야 한다. (backend 인증을 응답 body 토큰 + Bearer 헤더 방식에서 쿠키 발급·인증 방식으로 전환)
- **FR-003**: 보호된 API 요청은 쿠키 기반으로 자동 인증되어야 한다. frontend 는 `/api` 요청을 same-origin 프록시로 보내(쿠키 자동 동봉), backend 인증 필터는 쿠키에서 토큰을 읽어야 한다. same-origin 이므로 CORS 교차 출처 설정은 불필요하다.
- **FR-004**: access token 만료 시 사용자 개입 없이 자동으로 세션을 갱신(refresh)해야 한다.
- **FR-005**: 인증 누락·만료·갱신 실패 시 보호 데이터를 노출하지 않고 로그인 화면으로 안내해야 한다.
- **FR-006**: 사용자는 로그아웃할 수 있어야 하며, 로그아웃 시 세션 쿠키가 무효화되어야 한다.
- **FR-007**: CSRF(요청 위조) 위험을 same-origin + SameSite=Lax 쿠키로 구조적으로 완화해야 한다. 상태 변경 요청은 비-GET(POST/PATCH/PUT/DELETE)으로 한정한다. (추가 CSRF 토큰 적용 여부는 plan 단계 방어 심층화 결정)
- **FR-008**: frontend 의 임시 `X-User-Id` 헤더 인증이 완전히 제거되어야 한다. (client.ts swap — ISSUE-015)
- **FR-009**: 신규 사용자는 이메일·비밀번호로 회원가입하고 이메일 인증을 완료할 수 있어야 한다.
- **FR-010**: 사용자는 비밀번호 재설정 흐름(요청 → 메일 → 새 비밀번호 → 완료)을 완료할 수 있어야 한다.
- **FR-011**: 사용자는 카카오로 로그인할 수 있고, 이메일 가입자는 본인 계정에 카카오를 추가 연결할 수 있어야 한다. 카카오 콜백은 세션 쿠키 발급 방식으로 동작해야 한다.
- **FR-012**: 로그인/가입/연결 실패(미인증 이메일, 계정 잠금, 비밀번호 불일치, 카카오 충돌 등)를 사용자에게 명확한 메시지로 표시해야 한다.

#### 홈 view (US1)

- **FR-013**: 홈(`/`)은 본인 프로젝트 목록을 카드로 표시해야 한다.
- **FR-014**: 프로젝트가 0개이면 빈 상태(H0) hero + "첫 프로젝트 만들기" CTA 를 표시해야 한다.
- **FR-015**: 홈의 CTA/버튼에서 새 프로젝트 만들기 화면으로 진입할 수 있어야 한다.

#### 새 프로젝트 (US2)

- **FR-016**: `/projects/new` 에서 제목(필수)과 메타 5필드(장르·목표 분량·톤 노트·시놉시스·세계관 메모, 모두 선택)로 프로젝트를 생성할 수 있어야 한다.
- **FR-017**: 생성 성공 시 해당 프로젝트 화면으로 이동해야 한다.
- **FR-018**: 제목 누락·길이 초과 등 검증 실패를 폼에 표시하고 생성을 막아야 한다.

#### 프로젝트 메타 카드 / 편집 / 생명주기 (US3)

- **FR-019**: `/projects/{id}` 는 프로젝트 메타 카드(제목·장르·목표 분량·톤 노트·시놉시스·세계관 메모)를 표시해야 한다.
- **FR-020**: 전용 편집 페이지에서 메타를 부분 수정할 수 있어야 한다. 변경하지 않은 필드는 유지된다.
- **FR-021**: 프로젝트를 보관/보관 해제할 수 있어야 하며, 영구 삭제는 사용자 확인 후에만 수행해야 한다.

#### 등장인물 관리 (US4)

- **FR-022**: `/projects/{id}/characters` 는 인물 목록을 표시 순서(오름차순, 동순위는 생성 순)대로 표시해야 한다.
- **FR-023**: 인물을 추가(이름 필수)·편집·삭제할 수 있어야 한다.
- **FR-024**: 인물 표시 순서를 재정렬할 수 있어야 하며, 결과가 영속되어야 한다.

#### 공통 (전 화면)

- **FR-025**: 모든 데이터 화면은 미인증 시 로그인으로 안내(인증 가드)해야 한다.
- **FR-026**: 각 화면은 로딩·에러·빈 상태를 일관되게 표시해야 한다.
- **FR-027**: 새 화면은 002 가 확립한 디자인 토큰·다크 모드·컴포넌트와 시각적으로 일관되어야 한다.

### Key Entities *(표시·세션 관점 — 데이터 SoT 는 backend)*

- **인증 세션**: 로그인한 사용자를 식별하는 세션. frontend 는 토큰을 직접 보관하지 않고 httpOnly 쿠키에 의존한다(스크립트 접근 불가). 본인 정보(이메일·카카오 연결 여부)를 조회해 헤더 등에 표시한다.
- **Project (표시 모델)**: `id`, `title`(제목), `genre`(장르), `targetLength`(목표 분량, 자/단어), `toneNotes`(톤·문체 노트), `synopsis`(시놉시스), `worldNotes`(세계관 메모), `archivedAt`(보관 시각, null=활성), `createdAt`/`updatedAt`. backend 004 contract 정합.
- **Character (표시 모델)**: `id`, `projectId`, `name`(이름), `shortDescription`(한 줄 설명), `notes`(자유 노트), `displayOrder`(표시 순서). backend 004 contract 정합.
- **Document**: 프로젝트 생성 시 backend 에서 1:1 자동 생성되는 빈 본문. 본 spec 에서 본문 편집 UI 는 다루지 않는다(Week 3).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 사용자가 로그인 후 홈에서 본인 프로젝트 목록(또는 빈 상태)을 즉시(체감 3초 이내) 확인한다.
- **SC-002**: 002 dogfooding T051(홈 placeholder query → 목록 unwrap)이 GREEN — ISSUE-015 해소. 동일 시나리오가 이전엔 401 로 실패했다.
- **SC-003**: 로그인 후 새로고침·탭 재개 시 재로그인 없이 세션이 유지된다(100% 재현).
- **SC-004**: 사용자가 새 프로젝트를 2분 이내에 생성하고 해당 프로젝트 화면에 도달한다.
- **SC-005**: 인증 누락·만료 상태에서 어떤 보호 데이터도 화면에 노출되지 않고 로그인으로 안내된다(데이터 0 노출).
- **SC-006**: 등장인물 재정렬 결과가 새로고침 후에도 동일 순서로 유지된다.
- **SC-007**: 인증 4종 흐름(이메일 로그인, 회원가입+인증, 비밀번호 재설정, 카카오 로그인/연결)이 각각 정상 완료된다.
- **SC-008**: frontend 코드 전체에서 임시 `X-User-Id` 주입 코드가 0건이다(grep 검증).
- **SC-009**: 새 화면(홈·새 프로젝트·메타·등장인물)이 라이트/다크 양쪽에서 002 디자인 토큰과 시각적으로 일관된다.

## Assumptions

- **backend 가용성**: 003 인증 API + 004 Project/Character API 가 로컬(bootRun) 환경에서 동작한다고 가정한다.
- **세션 토큰 저장 = httpOnly 쿠키 (사용자 결정)**: backend 003 인증을 쿠키 기반으로 전환한다 — 로그인/refresh/카카오 콜백 응답의 Set-Cookie 발급, 인증 필터의 쿠키 read. **frontend↔backend 는 same-origin 프록시로 묶어**(Clarifications 2026-05-28) cross-site 쿠키 제약과 CORS 를 회피하고 SameSite=Lax 로 통일한다. 005 가 frontend + backend 혼합 phase 임을 전제한다.
- **same-origin 프록시**: frontend(Next.js / Vercel)가 `/api/*` 요청을 backend 로 프록시(rewrites)해 브라우저 관점에서 same-origin 을 유지한다. 로컬에서도 frontend dev server 가 `/api` 를 backend(`localhost:8080`)로 프록시한다. (Next.js 16 의 rewrites 동작은 plan/research 검증 — ISSUE-003 정합성 영역)
- **카카오 콜백 전환**: 현재 콜백이 토큰을 URL fragment(`#access=...&refresh=...`)로 frontend 에 넘기는 방식 → 콜백에서 세션 쿠키를 심고 redirect 하는 방식으로 변경한다. same-origin 프록시 하에서 콜백도 frontend 출처 경로(`/api/auth/oauth/kakao/callback`)를 경유해 쿠키가 frontend 출처에 심기도록 한다 (구체 redirect_uri 구성은 plan 단계).
- **화면 형태 = 별도 페이지 (사용자 결정)**: 새 프로젝트 = `/projects/new`, 메타 편집 = 전용 편집 페이지. 미디자인 영역이므로 002 가 확립한 디자인 토큰·컴포넌트를 재사용해 마무리한다.
- **단일 사용자(V1)**: 본인 1명 dogfooding 환경. 다중 사용자 협업·실시간 동기화는 out of scope.
- **out of scope (후속 Week)**: 본문 에디터·원고지(Week 3), 메모 캡처·inbox(Week 4), 세션 노트·메모 핀·검색(Week 5), 미리보기·설정·PWA 마무리(Week 6). 홈 카드의 "지난 세션 인용"·진행률 ring 은 Week 5 합류 전까지 placeholder 로 유지한다.
- **`frontend/AGENTS.md` 정합성**: AGENTS.md 가 인용하는 `node_modules/next/dist/docs/` 디렉토리는 현재 부재(ISSUE-003). plan/research 단계에서 본질 정의 문서의 실제 정합성을 검증한다(`.claude/rules/shared/agent-workflow-discipline.md §5`).

## Dependencies

- **003 Phase 1B Backend Auth**: 인증 API 12종 + JWT util + SecurityConfig + LoginAttemptFilter — 쿠키 전환의 직접 대상.
- **004 Phase 2 Backend Project & Character**: Project 7 endpoint + Character 6 endpoint — 데이터 화면 연동 대상.
- **002 Frontend Route Scaffold**: 라우트 골격(인증 패널 + 메인 view) + 디자인 토큰 + 다크 모드 + React Query + Zustand + `client.ts`(swap 대상) + 인증 폼 정적 외관(LoginForm 등 — 실동작 부여 대상).
