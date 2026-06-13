# Research: 챕터(Chapter) — 작품 1:N 본문 구조

**Phase 0 산출** — 설계 SoT(`docs/superpowers/specs/2026-06-11-chapters-design.ko.md`)가 핵심 결정을 확정했고, 본 문서는 그 결정을 근거/대안과 함께 정리 + 코드베이스 실측으로 검증한 사항을 더한다. NEEDS CLARIFICATION 0건.

## D1. 데이터 구조 — 기존 documents 테이블 1:N 확장

- **Decision**: 신규 테이블 없이 기존 `documents` 테이블 재사용. `project_id` UNIQUE 제거 + `sort_order`·`deleted_at` 추가. 챕터 1개 = document 1행.
- **Rationale**: 본문 저장 구조(`body` jsonb·`word_count`·`@Version updated_at`)·자동저장(016)·낙관적 잠금이 모두 document id 단위로 이미 동작 → 챕터가 document 가 되면 자동저장/초안/충돌 격리가 **추가 설계 없이** 성립. 기존 본문은 `sort_order=0` 1번 챕터로 무손실 편입(이관 스크립트 불필요).
- **Alternatives considered**:
  - 신규 `chapters` 테이블 + `documents.chapter_id` — 본문 저장 경로 전부 재배선 필요, 016 세션 키 재설계 위험. 탈락.
  - 안 B "단일 문서 내 H1 = 챕터" — 순서 재배열이 ProseMirror 본문 직접 수술 → 한국어 IME·자동저장 회귀 위험 + export 파싱 의존. 설계에서 명시 탈락.

## D2. 삭제 정책 — soft-delete + 되돌리기

- **Decision**: `deleted_at` 표시만(복구 가능). 삭제 직후 되돌리기 토스트. Round 1 곁쪽지(Memo) 삭제와 동일 패턴.
- **Rationale**: 작가의 원고 삭제는 되돌릴 수 있어야 안전. 기존 `MemoEditService` soft-delete + `POST /{id}/restore` + 부분 인덱스(`WHERE deleted_at IS NULL`)가 검증된 레퍼런스.
- **Alternatives considered**: hard-delete — 복구 불가, 작가 데이터 안전성 미달. 탈락.

## D3. 마이그레이션 버전 — V14 (실측 정정)

- **Decision**: `V14__documents_chapters.sql`.
- **Rationale**: 설계 작성(2026-06-11) 당시 V9 로 표기했으나, 코드베이스 실측 결과 현 최신은 **V13**(019 V9~V11 + 020 V12·V13 점유). 충돌 회피 위해 V14. 설계·계획 문서 정정 완료(2026-06-13).
- **검증**: `ls backend/src/main/resources/db/migration/` → V13 최신 확인.

## D4. 챕터 전환 · 자동저장 세션

- **Decision**: 전환 = URL 쿼리 `?chapter={documentId}`. 쿼리 없으면 가장 최근 수정 활성 챕터로 진입. 전환 시 에디터·`useDocumentSession` 을 새 documentId 로 재마운트(`editorKey+1`), **전환 직전 현재 챕터 초안 flush**.
- **Rationale**: URL 쿼리 = 재진입·새로고침 복귀 자연 지원 + 별도 상태 스토어 불필요. 016 의 `wn:draft:doc:{documentId}` 초안 키·잠금 토큰이 문서 id 단위라 챕터별 격리 자동 성립. flush 누락 시 한국어 IME 조합 중 전환에서 작성분 유실(016 회귀 영역) → 언마운트 flush 재사용으로 방어.
- **Alternatives considered**: Zustand 전역 currentChapter 상태 — 새로고침 복귀 미지원, URL 대비 이점 없음. 탈락.

## D5. 순서 변경 — 위/아래 버튼 + 전량 검증

- **Decision**: 드래그 앤 드롭 대신 위/아래 버튼. 서버는 활성 챕터 id 전량 배열을 받아 누락·중복·소속 검증 후 일괄 반영. 004 `CharacterReorderValidator` 패턴 복제 → `ChapterReorderValidator`.
- **Rationale**: 검증된 reorder 패턴(전체집합 검증 후 index 를 sort_order 로 대입, dirty-check 저장) 재사용으로 위험 최소. 드래그는 후속 후보.
- **Alternatives considered**: 단건 swap endpoint — 동시성·정합 취약. 전량 배열 방식이 정합 보장.

## D6. 대시보드 카드 집계 재설계

- **Decision**: `ProjectService.listCards` 의 "문서 1개" 가정 제거. 활성 챕터(`deleted_at IS NULL`) `word_count` 합산, `documentUpdatedAt`=활성 최신, 마지막 문장=최근 수정 활성 챕터 본문. `ProjectCardResponse` 스키마 불변.
- **Rationale**: 챕터 도입으로 단일 본문 lookup(`documentsByProjectId[projectId]`)이 깨짐 → N개 합산 필요. 기존 3쿼리 일괄(N+1 금지) 구조 유지하며 `findByProjectIdIn` 에 활성 필터 추가 후 메모리 집계. DTO 불변이라 **프론트 표시 코드 변경 0**.
- **검증**: `ProjectService.listCards`(ProjectService.kt:80) 3쿼리 구조 실측.

## D7. 챕터 목록 UI — A·B 공용 presentational

- **Decision**: `ChapterList.tsx` 를 순수 presentational(props: 챕터배열·현재·onSelect·onCreate·onMove·onDelete)로 만들어 A형(`projects/[id]/write`)·B형(`b/works/[id]`) 양쪽에서 재사용. 좌측 패널 상단(아웃라인 위)에 배치.
- **Rationale**: B형 집필실이 독립 라우트(좌패널 inline+drawer 2중 렌더)로 별도 존재 → 로직 중복 방지 위해 표시 컴포넌트 공용화. 017 3단 골격·접기 토글 불변.
- **Alternatives considered**: A·B 각각 별도 구현 — 중복·드리프트 위험. 탈락.

## D8. 마지막 챕터 가드 — 이중 방어 + error.code 분기

- **Decision**: 마지막 활성 챕터 삭제 = 화면 버튼 `disabled`(1차) + 서버 `409 LAST_CHAPTER_UNDELETABLE`(2차). 프론트 `client.ts` 는 `error.code === "LAST_CHAPTER_UNDELETABLE"` 기준 분기.
- **Rationale**: 불변식(활성 ≥ 1) 보호. 409 는 `DOCUMENT_VERSION_CONFLICT`·`EMAIL_ALREADY_REGISTERED` 와 status 공유 → status 단독 분기 금지(typescript code-quality HARD-GATE, 006 회귀 사례). 신규 status 분기 추가 시 기존 409 코드 grep 의무.
- **검증**: `client.ts:71-88` 기존 409 분기 패턴 실측.

## D9. 인접 챕터 자동 전환 방향 (인터뷰 확정 2026-06-13)

- **Decision**: 현재 보는 챕터 삭제 시 **바로 앞 챕터로 전환, 맨 앞 챕터였으면 바로 다음 챕터로**.
- **Rationale**: 작가가 순서대로 읽던 맥락 유지. 대안(다음 우선 / 항상 첫 챕터)은 보던 위치 맥락 손실.

## D10. 새 챕터 기본 제목 (인터뷰 확정 2026-06-13)

- **Decision**: 새 챕터 기본 제목 = **`새 챕터`(고정 문구)**. 작가가 언제든 수정.
- **Rationale**: 작가가 바로 알아봄. 자동 번호("N장")는 순서 변경 시 번호-위치 불일치 위험(번호 재계산 안 함), 빈 제목은 목록 식별성 낮음. 동명 다수는 직접 수정 유도.
- **Note**: 기존 본문 title 규칙(≤120, 빈 허용) 위에서 기본값만 `새 챕터` 로 채움.
