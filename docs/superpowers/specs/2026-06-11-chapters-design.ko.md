# 챕터(Chapter) 기능 설계 — 작품 1:N 본문 구조 확장

**일자:** 2026-06-11
**상태:** 설계 확정 (사용자 승인 대기 → 승인 후 writing-plans 진입)
**트랙:** Web 런칭 V1 준비 (`docs/plan/04-web-launch-v1-plan.md`) — **Round 2.5 신규 삽입** (Round 2 집필실 ↔ Round 3 export 사이)

## 1. 배경 · 목표

현재 web 앱은 작품(project) 1개당 본문(document) 1개만 가진다 — DB `documents.project_id UNIQUE` 제약부터 프론트 쿼리 키까지 1:1 가정이 전 레이어에 박혀 있다. 본 설계는 이를 **작품 1 : 챕터 N** 구조로 확장한다.

**요구사항 (사용자 확정 2026-06-11):**

1. 하나의 작품은 여러 챕터로 구성된다.
2. 챕터는 작품 안에서 순서 조절이 가능하다.
3. "조합" = ① 작품 안 순서 재배열 + ② export 시 챕터를 골라 묶기. **작품 횡단(다른 작품의 챕터 가져오기)은 범위 밖** — 챕터는 자기 작품에만 속한다 (1:N, 다대다 아님).

**사용자 결정 사항:**

| 결정 | 내용 |
|---|---|
| 구조 | **안 A** — 기존 `documents` 테이블을 1:N 으로 확장 (신규 테이블 없음). 기존 본문 = 1번 챕터로 무손실 이관 |
| 삭제 정책 | **복구 가능 삭제(soft-delete)** — 삭제 표시(`deleted_at`)만 하고 되돌리기 제공. Round 1 곁쪽지 삭제(A1, ISSUE-026)와 동일 패턴 |
| 라운드 배치 | Round 2.5 신규 삽입 — export(Round 3)가 "챕터 합본"에 의존하므로 export 선행 필수 |

**탈락 대안 (기록):** 안 B "단일 문서 내 H1 제목 = 챕터" — 마이그레이션 0 이지만, 순서 재배열이 ProseMirror 본문 직접 수술이라 한국어 IME·자동저장 회귀 위험이 크고, 문서 비대화·export 파싱 의존 문제로 탈락.

## 2. 비범위 (Out of Scope)

- 다른 작품의 챕터 가져오기/공유 (다대다) — 요구사항에서 명시 제외
- export 챕터 선택·합본 UI 구현 — **Round 3 export 설계에 요건으로 위임** (본 설계는 데이터 구조만 보장)
- 드래그 앤 드롭 순서 변경 — 위/아래 버튼으로 시작, 드래그는 후속 후보
- 챕터 묶음(부/권) 등 상위 계층 — 단일 평면 목록만
- 운영(Supabase) 마이그레이션 적용 — 기존 전략대로 Round 4 일괄 (신규 V14 는 로컬 dev DB 만)

## 3. 데이터 모델 — V14 마이그레이션

> **버전 정정(2026-06-13):** 본 설계 작성(2026-06-11) 당시 챕터 마이그레이션을 V9 로 적었으나, 이후 019(V9~V11)·020(V12·V13)이 실제 점유 → 챕터는 **V14** 로 진행.

`documents` 테이블 재사용. **챕터 = document 행 1개.** 신규 테이블 없음.

```sql
-- V14__documents_chapters.sql (개요)
ALTER TABLE documents DROP CONSTRAINT documents_project_id_key;       -- 1:1 강제 해제 (V5 컬럼 인라인 UNIQUE 의 Postgres 자동 명명)
ALTER TABLE documents ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0; -- 작품 안 챕터 순서 (0부터)
ALTER TABLE documents ADD COLUMN deleted_at TIMESTAMPTZ NULL;           -- soft-delete 표시
CREATE INDEX idx_documents_project_sort ON documents (project_id, sort_order);
```

- 기존 행은 `sort_order = 0`, `deleted_at = NULL` 로 그대로 1번 챕터가 됨 — **데이터 무손실, 별도 이관 스크립트 불필요.**
- `ON DELETE CASCADE` (작품 삭제 시 챕터 전체 삭제) 는 V5 그대로 유지.
- 챕터 제목 = 기존 `title` 컬럼 재사용 (≤120자).
- 낙관적 잠금 토큰(`updated_at` `@Version`, V8) 은 챕터별로 그대로 동작 — 변경 없음.

**엔티티 변경 (`Document.kt`):** `projectId` 의 `unique = true` 제거, `sortOrder: Int`, `deletedAt: Instant?` 추가.

**불변식:** 작품에는 **활성(미삭제) 챕터가 항상 최소 1개** 존재한다. 작품 생성 시 챕터 1개 자동 생성(기존 자동 프로비저닝 유지), 마지막 활성 챕터 삭제 거부.

## 4. 백엔드 API

| 변경 | endpoint | 내용 |
|---|---|---|
| 신설 | `GET /api/projects/{projectId}/documents` | 챕터 목록 — `deleted_at IS NULL`, `sort_order ASC`. **본문(body) 제외** 메타만(id·title·sortOrder·wordCount·updatedAt) — 전송량 절약 |
| 신설 | `POST /api/projects/{projectId}/documents` | 챕터 생성 — title 받고 `sort_order = (활성 최대값)+1` 맨 뒤 추가. 응답에 본문 포함(생성 직후 진입용) |
| 신설 | `PUT /api/projects/{projectId}/documents/order` | 순서 일괄 변경 — 활성 챕터 id 전량·중복 없음·소속 일치 검증 (004 `CharacterReorderValidator` 패턴 재사용) |
| 신설 | `DELETE /api/documents/{id}` | soft-delete — `deleted_at = now()`. **마지막 활성 챕터면 409 거부**(전용 에러 코드, 아래 §4-1) |
| 신설 | `POST /api/documents/{id}/restore` | 복구 — `deleted_at = NULL`. 순서는 활성 맨 뒤로 재배치(원래 자리 보존은 비범위) |
| 대체 | `GET /api/projects/{projectId}/document` (단수) | **제거** — 목록 endpoint 로 대체. 소비자가 자사 프론트뿐이라 호환 유지 불필요 |
| 불변 | `PUT /api/documents/{id}` (자동저장) / `PATCH /api/documents/{id}/title` | 이미 문서 id 단위 — 그대로 챕터별 자동저장·제목 변경으로 동작. 단, 삭제된 챕터에 대한 저장은 404 |

**소유권 검증:** 기존 패턴 유지 — documentId 로 찾은 뒤 projectId 경유 소유권 확인.

### 4-1. 에러 코드

- 마지막 활성 챕터 삭제 시도 → `409 LAST_CHAPTER_UNDELETABLE` (신규). **주의:** 공용 fetch 래퍼는 status 단독 분기 금지 — `error.code` 기준 분기 (typescript code-quality HARD-GATE, 409 는 `DOCUMENT_VERSION_CONFLICT`·`EMAIL_ALREADY_REGISTERED` 등과 공유).
- reorder 검증 실패 → 기존 `400 VALIDATION_FAILED` 재사용.

### 4-2. 대시보드 카드 집계 재설계 (`GET /api/projects/cards`)

`ProjectService.listCards()` 의 "문서 1개 부재 시 throw" 가정을 제거하고:

- **글자수** = 활성 챕터 `word_count` 합산
- **documentUpdatedAt** = 활성 챕터 중 최신 `updated_at`
- **마지막 문장 원천** = 가장 최근 수정된 활성 챕터의 본문 (현 파생 로직 재사용, 원천만 교체)
- 일괄 조회(N+1 금지) 유지 — `findByProjectIdIn` 에 `deletedAt IS NULL` 필터 추가 후 메모리 집계. 응답 스키마(`ProjectCardResponse`) **불변** → 프론트 대시보드 표시 코드 변경 0.

## 5. 프론트엔드

### 5-1. 집필실 (`/projects/[id]/write`) — 좌측 패널 2단

017 의 3단 골격 `[좌패널 | 원고 | 인물+곁쪽지]` 와 접기 토글은 불변. 좌측 패널만 2단으로:

- **상단 = 챕터 목록**: 순서대로 표시, 현재 챕터 하이라이트, "새 챕터" 버튼, 항목별 위/아래 순서 버튼 + 삭제 버튼.
- **하단 = 기존 아웃라인**: 현재 챕터의 H1/H2 목차 (`outlineFromDoc` 그대로 — 챕터 단위로 자연 동작).

### 5-2. 챕터 전환 · 자동저장 세션

- 전환 = URL 쿼리 `?chapter={documentId}` — 재진입·새로고침 시 같은 챕터 복귀. 쿼리 없으면 **가장 최근 수정한 활성 챕터**로 진입.
- 챕터 전환 시 에디터·세션(`useDocumentSession`) 을 새 documentId 로 재마운트. 016 재설계의 localStorage 초안 키(`wn:draft:doc:{documentId}`)·잠금 토큰이 이미 문서 id 단위라 **챕터별 자동저장·초안 복구·충돌 방지가 추가 설계 없이 격리**됨. 전환 직전 현재 챕터 초안 flush(기존 언마운트 flush 재사용).
- 쿼리 훅: `useProjectDocument(projectId)` (단수) → `useProjectChapters(projectId)` (목록) + `useChapterDocument(documentId)` (본문 단건, `staleTime: Infinity` 등 기존 정책 승계).
- `webElectronApi.documents` shim: `getByProject`(단수) 제거, `list`/`create`/`reorder`/`remove`/`restore`/`get` 으로 재구성. `update`(자동저장) 불변.

### 5-3. 삭제 · 되돌리기

- 삭제 버튼 → 즉시 soft-delete + **되돌리기 토스트** (Desktop Phase 5 곁쪽지 패턴 이식). 토스트 내 "되돌리기" = restore 호출.
- 현재 보고 있는 챕터를 삭제하면 인접 챕터로 자동 전환.
- 마지막 활성 챕터는 삭제 버튼 비활성(서버 409 는 방어선).

## 6. export(Round 3) 에 넘기는 요건

- export 단위 = "선택한 활성 챕터들의 `sort_order` 순 합본" (기본값 = 전체 챕터).
- 챕터 선택·순서 확인 UI 는 Round 3 export 설계 범위.

## 7. 테스트 · 검증

**TDD (글로벌 testing-strategy + 본 프로젝트 룰 정합):**

- 백엔드: 목록 정렬·삭제 필터 / reorder 검증(전량·중복·소속) / 마지막 활성 챕터 삭제 409 / restore 후 목록 복귀·순서 맨 뒤 / 카드 집계(합산·최신·삭제 제외) / V14 후 기존 데이터 보존(sort_order=0 단일 챕터로 조회).
- 프론트: 챕터 전환 시 초안 키 격리 / 목록·하이라이트 / 위·아래 순서 변경 / 삭제→되돌리기 토스트 / 마지막 챕터 삭제 비활성.

**dogfooding 게이트 (Round 5 에 항목 추가):**

- 한국어 IME 4케이스 (PoC 0-1 재사용 — 에디터 재마운트 경로가 생기므로 의무) + **조합 중 챕터 전환 무유실**.
- 챕터 전환·순서 변경·삭제/복구 실브라우저 확인.

**게이트:** 프론트 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` + 백엔드 `ktlint(main+test)·checkstyle·test·build` GREEN.

## 8. 라운드 배치 · 추정

- **Round 2.5 (신규)** — Round 2(집필실 기능) 뒤, Round 3(export) 앞. export 가 챕터 합본에 의존하므로 선행 필수.
- 추정 **5~7.5 dev-day** (백엔드 2.5~3.5 + 프론트 2.5~4, TDD 포함·dogfooding 별도). 런칭 합계 19.5~32d → **약 25~39.5d**.
- V14 는 로컬 dev DB 만 적용, 운영은 Round 4 일괄 (코드-우선 전략 유지).

## 9. 1:1 가정 해제 지점 체크리스트 (구현 시 전수 확인)

코드베이스 실측(2026-06-11)으로 확인된 1:1 가정 침투 지점:

| 레이어 | 지점 | 조치 |
|---|---|---|
| DB | `documents.project_id UNIQUE` (V5) | V14 에서 제거 |
| BE | `Document.projectId @Column(unique = true)` | 제거 + sortOrder·deletedAt 추가 |
| BE | `DocumentRepository.findByProjectId(): Optional` | 목록 메서드로 대체 |
| BE | `ProjectService.createProject` 자동 프로비저닝 | 유지 (챕터 1개 생성, sort_order=0) |
| BE | `ProjectService.listCards` 문서 부재 throw | 활성 챕터 집계로 재설계 (§4-2) |
| BE | `DocumentService.getDocumentByProjectId` (D1) | 목록 서비스로 대체 |
| FE | 쿼리 키 `["document","byProject",projectId]` 단수 | chapters 목록 키 + 문서 단건 키로 분리 |
| FE | `webElectronApi.documents.getByProject` 단수 계약 | §5-2 재구성 |
| FE | `write/page.tsx` 문서 1개 로드 | 목록→선택(쿼리 파라미터) 흐름 |
| FE | `draftStore` 키 `wn:draft:doc:{documentId}` | **불변** — 문서 id 단위라 그대로 챕터별 격리 |
| FE | `outlineFromDoc` / `pageLayout` 순수 함수 | **불변** — 챕터(현재 문서) 단위로 자연 동작 |
| FE | 대시보드 `ProjectCard` 타입·표시 | **불변** — 백엔드 집계만 교체 |
