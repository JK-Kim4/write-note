# Feature Specification: Phase 2 Backend — Project Metadata & Character CRUD

**Feature Branch**: `004-phase-2-backend-project-character`

**Created**: 2026-05-25

**Status**: Draft

**Input**: User description: "Phase 2 backend: complete Project entity with V1 metadata fields, finalize Project CRUD with archive/unarchive/delete, and add Character entity with CRUD (per docs/plan/03-backend-requirements.md §2-2 and §3-3, 13 endpoints total)"

**Source documents (SoT)**:

- 본질·범위: [DESIGN.md 60-110, 124-147, 232-258, 282-285줄](../../DESIGN.md)
- Phase 분해: [docs/plan/01-phase-breakdown.md §5 Week 2 Phase 2-1·2-2·2-3](../../docs/plan/01-phase-breakdown.md)
- 도메인·계약 SoT: [docs/plan/03-backend-requirements.md §2-2 Project/Character/Document + §3-3 endpoint 13개](../../docs/plan/03-backend-requirements.md)
- 직전 결과: [specs/001-phase-1a-backend-scaffold/spec.md](../001-phase-1a-backend-scaffold/spec.md) — 최소 Project 필드 baseline / [specs/003-phase-1b-backend-auth/spec.md](../003-phase-1b-backend-auth/spec.md) — JWT 인증 결선

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Project Metadata Persistence (Priority: P1)

작가는 한 작품(프로젝트)에 장르·목표 분량·톤 노트·시놉시스·세계관 노트 같은 *영원히 살아있는 진실*을 저장하고 세션 간에 다시 볼 수 있어야 한다 (DESIGN.md 74-83줄 §"프로젝트 메타 카드"). Phase 1A 의 최소 Project 필드(제목/보관 여부) 위에 V1 범위 전체 메타 필드를 추가하고, 그 값들이 ownership 격리된 상태로 영속·갱신된다.

**Why this priority**: 메타 카드는 작가의 *재진입 비용*을 죽이는 첫 번째 신호 (DESIGN.md 287-295줄 §"세션 진입 메커니즘"). 메타가 저장되지 않으면 후속 메모 큐레이션 / 에디터 사이드 패널 / 세션 진입 hero 모두 의미를 잃는다.

**Independent Test**: 단일 사용자 컨텍스트에서 (a) 새 프로젝트 + 메타 5 필드 동시 입력 (b) 단건 조회로 같은 값 확인 (c) 부분 수정 후 변경 필드만 반영 확인 가능.

**Acceptance Scenarios**:

1. **Given** 인증된 사용자 컨텍스트, **When** 메타 5 필드(장르/목표 분량/톤 노트/시놉시스/세계관 노트) 모두 채워 새 프로젝트 생성, **Then** 모든 필드가 영속되고 단건 조회 응답에서 동일 값 반환됨
2. **Given** 메타 일부만 채워진 기존 프로젝트, **When** 부분 수정으로 빈 필드 채우거나 채워진 필드 비움, **Then** 명시된 필드만 갱신되고 나머지는 그대로 유지됨
3. **Given** 다른 사용자 소유 프로젝트, **When** 현 사용자 컨텍스트로 단건 조회·수정 시도, **Then** 정보 노출 없이 "리소스 없음" 결과 반환

---

### User Story 2 - Project Lifecycle (Priority: P1)

작가는 더 이상 활발히 쓰지 않는 프로젝트를 홈 활성 목록에서 *치우면서 흔적은 남기고* (보관), 필요하면 다시 *되돌리고* (보관 해제), 영구히 *지울 수 있어야* 한다 (DESIGN.md 234줄 "보관함"). 보관은 보관 시각 표기, 삭제는 cascade 로 등장인물 / 본문 / 세션 노트 / 메모 연결까지 정리.

**Why this priority**: 홈 카드 빈 상태 H0 ↔ 활성 1+ 분기 (002 Q4) 의 *활성 카운트* 가 본 lifecycle 에 직접 의존. 보관·삭제 미작동 = 홈 view 가 영원히 모든 프로젝트 보임.

**Independent Test**: (a) 프로젝트 2개 생성 (b) 1개 보관 후 활성 목록에서 빠짐 확인 (c) 보관 해제 후 다시 활성 등장 (d) 영구 삭제 → cascade 영향 받는 자식 데이터(등장인물 등) 도 없어졌는지 확인 가능.

**Acceptance Scenarios**:

1. **Given** 사용자가 다수 프로젝트 보유, **When** 활성 필터로 목록 조회, **Then** 보관된 프로젝트는 응답에서 빠지고 활성만 포함됨
2. **Given** 보관된 프로젝트, **When** 보관 해제 동작 호출, **Then** 다음 활성 목록 조회 시 다시 포함됨
3. **Given** 등장인물 N 개 + 본문 1 개 + 세션 노트 M 개 가진 프로젝트, **When** 영구 삭제 호출, **Then** 프로젝트 + 자식 데이터(등장인물/본문/세션 노트/메모-프로젝트 연결) 모두 사라짐
4. **Given** 다른 사용자 소유 프로젝트, **When** 보관·해제·삭제 시도, **Then** "리소스 없음" 결과 반환

---

### User Story 3 - Document Auto-Provisioning (Priority: P2)

작가는 새 프로젝트를 만들면 즉시 본문 입력 가능한 상태여야 한다 (DESIGN.md 135-137줄 "MVP는 프로젝트당 1개 문서로 시작"). 별도 "본문 만들기" 단계 없이, 프로젝트 생성과 동시에 빈 본문 1 행이 1:1 로 자동 생성된다.

**Why this priority**: 본 백엔드 spec scope 안에서 본문 CRUD 자체는 Week 3 영역이지만, 프로젝트 ↔ 본문 1:1 관계는 *프로젝트 생성 시점에 박는 결정* 이라 Phase 2 백엔드 안에서 처리. Week 3 가 본문 입력 UI 작성 시 "본문 만들기" 단계 추가 필요 없음.

**Independent Test**: (a) 새 프로젝트 생성 (b) 응답 또는 별도 조회로 빈 본문 행 존재 확인 (c) 프로젝트 삭제 시 본문 행도 사라지는지 확인 가능.

**Acceptance Scenarios**:

1. **Given** 새 프로젝트 생성 요청, **When** 생성 성공, **Then** 같은 트랜잭션 안에서 빈 본문 행이 1:1 로 함께 생성됨
2. **Given** 프로젝트 영구 삭제, **When** 삭제 성공, **Then** 1:1 본문 행도 함께 사라짐

---

### User Story 4 - Character CRUD (Priority: P2)

작가는 한 프로젝트의 등장인물을 추가·수정·삭제·조회할 수 있어야 한다 (DESIGN.md 80, 132-134줄). 인물 = 이름 + 한 줄 설명 + 자유 노트. 본 spec 은 데이터 영역만 — UI 페이지는 Phase 2-7 (frontend) 영역.

**Why this priority**: 메모 큐레이션 (Week 4) 의 "등장인물 연결" 기능이 본 entity 존재에 직접 의존. 단, 본 spec 안에서는 메모 큐레이션 사용처는 만들지 않음 — 데이터 형태와 CRUD 만 박음.

**Independent Test**: (a) 프로젝트 1개 + 인물 3개 생성 (b) 목록 조회 시 모두 등장 (c) 1명 수정 → 변경 반영 (d) 1명 삭제 → 목록에서 제외 (e) 다른 사용자 소유 프로젝트의 인물 조회 시도 시 차단 확인 가능.

**Acceptance Scenarios**:

1. **Given** 사용자 소유 프로젝트, **When** 인물 추가 (이름 + 짧은 설명 + 노트), **Then** 인물이 영속되고 목록 조회 응답에 등장
2. **Given** 인물 다수 보유 프로젝트, **When** 인물 목록 조회, **Then** 일관된 순서로 응답 (표시 순서 오름차순, 동순위는 생성 순)
3. **Given** 다른 사용자 소유 프로젝트의 인물, **When** 현 사용자 컨텍스트로 조회·수정·삭제 시도, **Then** "리소스 없음" 결과 반환

---

### User Story 5 - Character Ordering (Priority: P3)

작가는 등장인물 카드 순서를 직접 정렬할 수 있어야 한다 (사이드 패널 표시 순서 = display_order). 일괄 reorder 동작 1회로 새 순서 전체를 전송, 서버는 같은 트랜잭션에서 모든 인물 표시 순서 갱신.

**Why this priority**: 정렬은 본 spec 의 핵심 기능이 아니지만 (인물 4~5명 환경에서 자연 순서로 충분), 03-backend-requirements §3-3 에 reorder 동작 박혀있어 본 spec 에 포함. UI 드래그 정렬은 Phase 2-7 (frontend).

**Independent Test**: (a) 인물 3명 (표시 순서 0/1/2) (b) 새 순서 (2/0/1) 일괄 전송 (c) 다음 목록 조회 시 순서 변경 반영 확인 가능.

**Acceptance Scenarios**:

1. **Given** 인물 N 명 보유 프로젝트, **When** N 명 전체 새 순서 일괄 전송, **Then** 모든 인물 표시 순서가 단일 트랜잭션으로 갱신됨
2. **Given** 일부 인물 누락된 reorder 요청, **When** 검증, **Then** 요청 거부 (불완전 reorder 방지 — 03-backend-requirements §3-3 의 "전체 새 순서 전송" 정합)

---

### Edge Cases

- 메타 5 필드 모두 빈 값으로 프로젝트 생성 (제목만 필수)
- 메타 필드의 길이 경계값 (긴 시놉시스 / 세계관 노트)
- 보관 상태에서 메타 수정 시도 (허용 — 보관 != 동결)
- 보관된 프로젝트의 등장인물 CRUD 시도 (허용 — 보관해도 인물 정리는 자유)
- 영구 삭제된 프로젝트의 ID 로 즉시 메타 수정 시도 → "리소스 없음"
- 같은 이름 등장인물 중복 추가 (허용 — 이름 유일 제약 없음)
- 인물 0명 프로젝트의 reorder 요청 (빈 배열 전송 시 no-op)
- 페이지네이션 경계값 (page=0 / size 최대치 / 잘못된 sort 필드)
- 목록 조회 시 자식 카운트 / 메타 표시에 따른 N+1 쿼리 회귀
- 새 프로젝트 생성 시 자동 본문 행 생성 실패 → 트랜잭션 롤백 (반쪽 상태 회피)

## Requirements *(mandatory)*

### Functional Requirements

#### Project Metadata Extension

- **FR-001**: 시스템은 Project 에 장르(자유 텍스트, 선택), 목표 분량(자수 정수, 선택), 톤 노트(긴 텍스트, 선택), 시놉시스(긴 텍스트, 선택), 세계관 노트(긴 텍스트, 선택) 5 필드를 추가해야 한다
- **FR-002**: 시스템은 Project 의 보관 상태를 boolean 이 아닌 *보관 시각* (timestamp, 미보관=NULL) 으로 표현해야 한다 — 기존 boolean 필드는 마이그레이션으로 변환 (true → 마이그레이션 시각, false → NULL)
- **FR-003**: 시스템은 Project 생성 시 5 메타 필드 모두 비어있어도 (제목만으로) 생성 가능해야 한다
- **FR-004**: 시스템은 Project 의 메타 5 필드를 부분 수정할 수 있어야 한다 — 명시된 필드만 갱신, 미명시 필드는 기존 값 유지

#### Project Lifecycle

- **FR-005**: 시스템은 Project 목록을 활성/보관 필터로 분리 조회할 수 있어야 한다
- **FR-006**: 시스템은 Project 보관 동작과 보관 해제 동작을 명시적 별도 동작으로 제공해야 한다
- **FR-007**: 시스템은 Project 영구 삭제 동작을 제공해야 하며, 그 결과로 자식 데이터 (등장인물 / 본문 / 세션 노트 / 메모-프로젝트 연결) 도 함께 사라져야 한다
- **FR-008**: 시스템은 모든 Project 동작 (조회 / 수정 / 보관 / 해제 / 삭제) 에서 ownership 스코프를 강제해야 하며, 다른 사용자 소유 리소스 접근 시 "리소스 없음" 결과를 반환해야 한다 (정보 노출 회피)

#### Document Auto-Provisioning

- **FR-009**: 시스템은 새 Project 생성 시 같은 트랜잭션 안에서 빈 본문(Document) 1 행을 1:1 관계로 자동 생성해야 한다
- **FR-010**: 시스템은 본문 자동 생성 실패 시 Project 생성 트랜잭션 전체를 롤백해야 한다 (Project 만 생성된 반쪽 상태 회피)
- **FR-011**: 시스템은 Project 영구 삭제 시 연관 본문 행도 함께 사라지게 해야 한다

#### Character Entity & CRUD

- **FR-012**: 시스템은 새 Character entity 를 도입해야 하며 필드는 이름(필수), 짧은 설명(선택), 자유 노트(선택), 표시 순서(정수, 기본 0), 생성·수정 시각이다
- **FR-013**: 시스템은 한 Project 의 Character 목록을 표시 순서 오름차순 + 동순위는 생성 순으로 정렬 조회할 수 있어야 한다
- **FR-014**: 시스템은 Character 추가 / 단건 조회 / 부분 수정 / 삭제 동작을 제공해야 한다
- **FR-015**: 시스템은 모든 Character 동작에서 *해당 Project 의 소유주가 현 사용자인지* 검증해야 하며, 위배 시 "리소스 없음" 반환
- **FR-016**: 시스템은 한 Project 의 Character 표시 순서를 일괄 reorder 할 수 있는 동작을 제공해야 한다 (전체 새 순서 일괄 전송, 부분 reorder 거부)

#### 응답 / 검증 / 페이지네이션 / 인증

- **FR-017**: 시스템은 본 spec 의 모든 응답을 기존 표준 응답 envelope (001 FR-007/008 도입) 형식으로 반환해야 한다
- **FR-018**: 시스템은 Project / Character 목록 조회 모두 페이지네이션 + 최대 페이지 크기 100 제한을 적용해야 한다
- **FR-019**: 시스템은 Project / Character 목록 조회 시 N+1 쿼리 패턴을 회피해야 한다 (각 행마다 추가 쿼리 발생 X)
- **FR-020**: 시스템은 본 spec 의 모든 엔드포인트를 인증된 사용자 컨텍스트 (003 Phase 1B 도입 JWT 인증 결과) 안에서만 접근 가능해야 한다

#### 마이그레이션 / 영속 검증

- **FR-021**: 시스템은 본 spec 의 entity 변경 (Project 메타 5 필드 + archived → archived_at 변환 + Character 신설 + 본문 1:1 FK 강화) 을 새 마이그레이션 1개로 적용해야 한다 (기존 V1~V4 위에 V5)
- **FR-022**: 시스템은 본 spec 의 모든 영속 동작에 대해 자동 검증 (write → read 사이클) 을 포함해야 한다 — in-memory state 만으로 검증 X (001 FR-016 정합)
- **FR-023**: 시스템은 본 spec 의 통합 검증 게이트 (코드 스타일 / 자동 테스트 / 빌드) 가 모두 GREEN 일 때만 본 spec 종료 박는다 (001 FR-017 정합)

### Key Entities *(include if feature involves data)*

- **Project (확장)**: 작가의 한 작품. Phase 1A 의 최소 필드(id / 소유주 / 제목 / 생성·수정 시각) 위에 장르 / 목표 분량 / 톤 노트 / 시놉시스 / 세계관 노트 5 메타 필드 추가 + 보관 표현이 boolean 에서 *보관 시각* 으로 변경.
- **Character (신설)**: 한 프로젝트의 등장인물. 이름 + 짧은 설명 + 자유 노트 + 표시 순서. 프로젝트와 N:1 관계 + 프로젝트 영구 삭제 시 함께 사라짐.
- **Document (자동 생성 강화)**: 작품의 본문. 본 spec 에서는 *프로젝트 생성 시 자동 1:1 행 생성 + 프로젝트 삭제 시 함께 사라짐* 만 박음. 본문 CRUD 자체는 Week 3 영역.
- **Response Envelope (재사용)**: 001 도입 표준 응답·에러 envelope 그대로.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 본 spec 적용 후 한 사용자 컨텍스트에서 새 프로젝트 + 메타 5 필드 모두 채워 영속 → 즉시 다른 세션으로 재진입 후 같은 값 조회 가능
- **SC-002**: 본 spec 적용 후 보관·해제·영구 삭제 동작 모두 작가가 기대한대로 즉시 반영됨 (활성 목록 분리 / 자식 데이터 정리)
- **SC-003**: 본 spec 적용 후 새 프로젝트 생성 후 별도 단계 없이 즉시 본문 입력 가능한 상태 (빈 본문 1:1 행 존재)
- **SC-004**: 본 spec 적용 후 한 프로젝트의 등장인물 N 명 (목표 ~5 명) 추가·수정·삭제·정렬 정상 동작
- **SC-005**: 본 spec 의 모든 엔드포인트가 ownership 스코프 격리 통과 (다른 사용자 소유 리소스 접근 시 정보 노출 0%)
- **SC-006**: 본 spec 마이그레이션 적용 시 기존 Phase 1A 의 Project 데이터 무손실 (제목 / 생성 시각 / 보관 여부 정합 보존)
- **SC-007**: 본 spec 의 검증 게이트 (코드 스타일 / 자동 테스트 / 빌드) BUILD SUCCESSFUL
- **SC-008**: 본 spec 의 모든 목록 조회에 페이지네이션 적용 + 최대 페이지 크기 100 강제
- **SC-009**: Project / Character 목록 조회 시 N+1 쿼리 0 회 (자동 측정 또는 코드 검토 통과)
- **SC-010**: 003 Phase 1B 의 임시 X-User-Id 청소 후 본 spec 의 모든 엔드포인트가 JWT 인증 컨텍스트에서만 동작 (인증 없이 호출 시 401)

## Assumptions

- 본 spec 은 **백엔드 전용** scope. 사용자 컨펌(2026-05-25) 결정 — `01-phase-breakdown.md §5 Week 2` 의 Phase 2-1·2-2·2-3 한정. **Frontend (Phase 2-4 홈 view / 2-5 새 프로젝트 만들기 흐름 / 2-6 메타 카드 UI / 2-7 등장인물 관리 페이지) 는 별도 후속 spec** (예: `005-phase-2-frontend-views`) 에서 진행
- **본 백엔드 spec GREEN 직후 후속 frontend spec 진입 트리거**: vault `~/obsidian/write-note/02-PROGRESS.md §2 "다음 진입점"` 에 frontend spec 진입 명시 박을 것. 본 spec 완료 보고 시점에 동시 갱신
- 본 spec 의 모든 API 계약 detail (HTTP 메서드 / 경로 / 페이로드 / 에러 코드) 은 `docs/plan/03-backend-requirements.md §3-3` 의 13 endpoint 가 SoT. 본 spec 은 그 명세를 *동작 요구사항* 으로 풀어쓴 것 — plan 단계에서 contracts/ 디렉토리에 OpenAPI 양식으로 박을 것
- 본 spec 의 entity 형태 detail (필드 타입 / 인덱스 / 제약 조건) 은 `docs/plan/03-backend-requirements.md §2-2` (Project / Character / Document) 가 SoT
- 인증·인가는 003 Phase 1B 의 JWT + 인증 컨텍스트 흐름 그대로 사용. 새 인증 메커니즘 도입 X
- 본문 CRUD (자동 저장 / 충돌 처리 / 본문 조회 endpoint) 는 Week 3 영역. 본 spec 은 *프로젝트 생성 시 빈 본문 자동 행 + 프로젝트 삭제 시 함께 사라짐* 만 다룸
- Memo / SessionNote / MemoProject / MemoProjectCharacter / ApiToken / AuthToken 의 *생성·CRUD* 는 본 spec scope 외 (각각 Week 4·5·1B 영역). 단, Project 영구 삭제 시 자식 데이터 정리 영향 대상에는 포함 (MemoProject / SessionNote / Document 등)
- 메타 5 필드의 길이 상한·검증 규칙 detail 은 03-backend-requirements 미명시 영역 — plan 단계에서 합리적 default (예: 자유 텍스트 최대 ~2000자) 박을 것. dogfooding 회귀 시 조정
