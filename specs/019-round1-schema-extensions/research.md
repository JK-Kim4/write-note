# Research: Round 1 스키마 확장 기능

**Date**: 2026-06-11 · **Spec**: [spec.md](./spec.md)

Phase 0 — Technical Context 의 미지수를 코드 실측으로 해소한 결정 기록. 모든 결정은 실제 코드 grep/Read 근거를 인용한다 (agent-workflow-discipline §1·§6 — 추측 영역은 옵션 확정 전 검증).

## D1. 곁쪽지 soft-delete — `deleted_at` 컬럼 + 필터 지점 전수

**Decision**: `memos.deleted_at TIMESTAMPTZ NULL` 추가(V9). 삭제 = `deleted_at = now()`, 복원 = `deleted_at = NULL`. **연결행(memo_projects·memo_project_characters)은 삭제하지 않고 보존** — 복원 시 작품 연결·고정 상태가 자동 복귀(desktop `memoRepository.ts:141-154` 와 동일 시맨틱).

**필터 적용 지점 전수 (실측)** — "deleted 제외" 를 박아야 하는 곳:

| # | 위치 | 쿼리 | 비고 |
|---|---|---|---|
| 1 | `MemoRepository.kt:29` | `findAllWithConnectionsByUserId` | 책상 전체 목록 (JPQL — count 쿼리도 양쪽) |
| 2 | `MemoRepository.kt:49` | `findUnclassifiedByUserId` | 미분류 필터 |
| 3 | `MemoRepository.kt:71` | `findAllWithConnectionsByUserIdAndProjectId` | 작품 필터 |
| 4 | `MemoRepository.kt:100` | `findAllWithConnectionsByUserIdAndCharacterId` | 인물 필터 |
| 5 | `MemoRepository.kt:123` | `findByUserIdAndTagNative` | 태그 — **native SQL** 이라 `m.deleted_at IS NULL` 컬럼명 직접 |
| 6 | `MemoRepository.kt:146` | `findAllWithConnectionsByUserIdAndQuery` | 본문 검색 |
| 7 | `MemoProjectRepository.kt:26` | `findAllByProjectIdWithMemo` | 작품 서랍(listByProject) + FE 재진입 카드(pickReentry, `memos.ts:113`)가 이 결과를 소비 — `AND m.deletedAt IS NULL` |

**단건 경로**: `findByIdAndUserId` 를 쓰는 getMemo(M2, `MemoQueryService.kt:104`)·updateMemo(M4)·curation·pin 은 삭제된 메모에 404(기존 `ResourceNotFoundException` 흐름). 신규 파생 쿼리 `findByIdAndUserIdAndDeletedAtIsNull` 로 교체하고, **restore·delete 만** 기존 `findByIdAndUserId`(deleted 포함)를 유지.

**Rationale**: desktop 이 이미 같은 모델로 사용자 검증됨. 연결행 보존이 "되돌리기 = 완전 복귀" 를 공짜로 만든다. 필터를 쿼리 레이어에 박으면 FE(web adapter `memos.ts`)는 변경 없이 자동으로 deleted 제외 목록을 받는다.

**Alternatives considered**:
- 연결행도 삭제 후 복원 시 재생성 → 복원 시 큐레이션 스냅샷 보관이 필요해져 복잡. 기각.
- Hibernate `@SQLRestriction`(전역 필터) → restore 경로가 deleted row 를 못 읽게 되어 우회 쿼리가 필요, 명시 필터 7곳이 더 단순·가시적. 기각.

## D2. 삭제·복원 멱등 시맨틱

**Decision**: 둘 다 멱등.
- `DELETE /api/memos/{id}` — 이미 삭제된 메모면 no-op 성공(204). desktop `UPDATE ... WHERE deleted_at IS NULL`(`memoRepository.ts:145`) 과 동일.
- `POST /api/memos/{id}/restore` — `deleted_at = NULL` 무조건 기록(desktop `:153` 과 동일). 미삭제 메모 restore 도 성공(200 + MemoResponse).
- 존재하지 않거나 남의 메모 → 404 (`ResourceNotFoundException`, 기존 에러 envelope).

**Rationale**: 토스트 중복 클릭·탭 중복에서 안전. 신규 에러 코드·HTTP status 분기가 없으므로 공용 `client.ts` 의 status 분기 룰(typescript code-quality HARD-GATE)에 저촉되지 않음 — grep 의무 발생 안 함.

## D3. 설정 저장 스키마 — key-value 행 테이블

**Decision**: `user_settings(user_id BIGINT FK→users, key VARCHAR(64), value VARCHAR(255), updated_at TIMESTAMPTZ, PK(user_id, key))` (V10). 서버는 **허용 key allowlist + key 별 값 검증**: `theme ∈ {light,dark,system}` / `writingMode ∈ {manuscript,editor}` / `manuscriptSize ∈ {200,400,1000}`.

API: `GET /api/settings` → 저장된 key-value 맵 / `PUT /api/settings` → 부분 맵 upsert(보낸 key 만 갱신, per-key last-write-wins).

**Rationale**: FR-010(스키마 파괴 없는 항목 추가) — Round 2 용지 크기는 allowlist 에 key 1줄 추가 + 마이그레이션 0. 행 단위 upsert 라 부분 갱신이 자연스럽고 JPA 매핑이 단순(복합키 `@EmbeddedId` 또는 단일 id + unique). 값 검증을 서버에 두는 이유: 임의 문자열 쓰레기 적재 방지(설정은 FE 가 즉시 해석하는 값이라 오염 시 화면 깨짐).

**Alternatives considered**:
- 단일 행 JSONB 컬럼 → 부분 갱신이 read-modify-write 가 되고 동시 갱신 시 통째 덮어쓰기(키 단위 LWW 불가). 기각.
- 고정 컬럼(theme·writing_mode·manuscript_size) → 항목 추가마다 마이그레이션 필요, FR-010 위반. 기각.

## D4. FE 설정 동기화 — 서버 SoT + localStorage 캐시 미러

**Decision**: zustand persist(`writenote.preferences.v1`, `preferences.ts:29-43`)는 **캐시로 유지**. 신규 클라이언트 컴포넌트(예: `PreferencesSync`)가 인증 확정 후 `GET /api/settings` 1회로 서버값을 store 에 주입(서버값 → set → persist 가 localStorage 갱신). 설정 변경 시 store 즉시 반영(낙관) + `PUT /api/settings` 비동기 전송. 서버에 저장값이 전혀 없으면 현재 로컬값을 최초 1회 PUT 으로 시딩(FR-008 — 기존 사용자 설정 유실 금지).

**FOUC 스크립트(`layout.tsx:38`)는 변경 0** — blocking inline script 는 서버를 동기 호출할 수 없으므로 localStorage 캐시를 계속 읽는다. 서버 하이드레이션이 localStorage 를 갱신해 두므로 다음 로드부터 새 테마가 첫 페인트에 반영(SC-004).

**Rationale**: 오프라인·서버 오류 시에도 로컬로 정상 동작(FR-009), 기존 store 소비자(설정 화면·ThemeToggle·집필실) 변경 불요 — 동기화 레이어만 추가.

**Alternatives considered**: React Query 로 서버 설정을 직접 구독 → FOUC 스크립트·기존 store 소비자 전면 개편 필요. 기각.

## D5. 성별 저장 — 문자열 코드 + DB CHECK

**Decision**: `characters.gender VARCHAR(16) NULL` + `CHECK (gender IN ('MALE','FEMALE','OTHER'))`. Kotlin 은 `String?` + 서버 검증(허용 외 값 400), FE 드롭다운이 남/여/기타/비움 ↔ 코드 매핑.

**Rationale**: 기존 선례 `Memo.source`(`Memo.kt:30-31` — 'MOBILE'/'DESKTOP' 문자열 + length 제한) 정합. TS 룰(enum 회피 — literal union)·Kotlin 양쪽에서 문자열 코드가 가장 단순. NULL = 비움(미설정) 허용은 spec 확정.

**Alternatives considered**: Kotlin enum + `@Enumerated(STRING)` → 값 추가 시 코드·DB CHECK 양쪽 수정은 동일한데 JPA 매핑만 한 겹 늘어남. 기각.

## D6. characters 신규 컬럼 타입

**Decision** (V11): `age VARCHAR(80) NULL`(자유 텍스트 — name 과 동일 길이 한도), `gender VARCHAR(16) NULL + CHECK`(D5), `traits TEXT NULL + CHECK(length(traits) <= 10000)`(기존 `notes` 와 동일 한도, `V5__...sql:32` 선례). DTO `@field:Size` 동일 한도.

## D7. Rail 등장인물 메뉴 목적지

**Decision**: 기존 "집필" 항목 패턴 재사용 — `getLastProject()`(`lastProject.ts:15`, key `wn:lastProjectId`)로 마지막 작품의 `/projects/{id}/characters` 로, 없으면 `/library`(작품 벽)로. `Rail.tsx` 의 Item 배열에 항목 추가(`match: p.includes("/characters")`).

**Rationale**: Rail "집필" 항목이 이미 동일 규칙("마지막 작품 → 없으면 작품 벽", `lastProject.ts:4-5` 주석)으로 동작 — 신규 규칙 발명 없이 정합. spec Assumptions 의 default 와 일치.

## D8. Toast 포팅

**Decision**: desktop `Toast.tsx`(31줄, `desktop/src/components/Toast.tsx`) 를 `frontend/src/components/ui/Toast.tsx` 로 1:1 포팅(`'use client'` 추가 — onClick prop, RSC 경계 HARD-GATE). **스타일은 이식 불요** — `.toast/.toast__msg/.toast__action` CSS 가 이미 `frontend/src/styles/desktop-app.css:910-925` 에 존재(015 때 이식됨, 실측 확인).

## D9. 책상 화면 삭제 UX

**Decision**: desktop `MemoInboxScreen.tsx:90-104` 패턴 1:1 — 낙관적 목록 제거 + `pendingDelete {id, seq}` state + Toast(seq 를 key 로 remount → 타이머 재시작) + 되돌리기 시 `restore` 호출 후 목록 재로드. web adapter `memos.ts` 에 `delete`/`restore` 메서드 추가(보류 주석 `memos.ts:12-13` 해소). API 클라이언트는 `deleteMemo` 가 이미 존재(`lib/api/memo.ts:107`), `restoreMemo` 만 신설.

## D10. 고정(pin) 불변식 × soft-delete 상호작용 (실측 검증)

**관찰**: `MemoPinService.kt:43` 의 "작품당 고정 1개" 해제 로직은 `findAllByProjectIdAndPinnedIsTrue`(memo_projects 행 기준)로 동작 — 삭제된 메모의 행도 포함하므로, 삭제된 고정 곁쪽지가 숨겨진 채 남아 있어도 **다른 메모 고정 시 자동 해제되어 불변식 유지**. 별도 처리 불요.

**Edge 문서화**: 고정 곁쪽지를 버린 뒤 다른 곁쪽지를 고정하면, 원래 곁쪽지를 되돌렸을 때 고정 상태는 해제돼 있다(불변식이 우선) — spec US1 시나리오 2 의 "고정 상태 보존" 은 "그 사이 다른 고정이 없었을 때" 로 해석. partial unique index(`uq_memo_project_pinned`)와도 충돌 없음.

## D11. 마이그레이션 번호·적용 범위 (사용자 확정 2026-06-11)

- V9 `add_memos_deleted_at` / V10 `create_user_settings` / V11 `expand_characters_age_gender_traits`
- 적용은 **로컬 dev DB 한정**(`docker compose` postgres + 테스트 Testcontainers 자동). 운영 Supabase 는 Round 4 일괄(외부 인프라 쓰기 = 사용자 컨펌 영역 — external-infra-safety HARD-GATE)
- 챕터 설계(Round 2.5)는 V12 이후 사용
