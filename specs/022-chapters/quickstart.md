# Quickstart: 챕터(Chapter) 로컬 검증

**Phase 1 산출** — 구현 후 로컬에서 챕터 기능을 검증하는 절차. 게이트 + dogfooding.

## 0. 환경

```bash
# 로컬 DB
docker compose up -d --wait postgres
# 백엔드 (V14 마이그레이션은 사용자 컨펌 후 flywayMigrate / bootRun 시 자동 적용)
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'
# 프론트
cd frontend && pnpm dev
```

> ⚠️ V14 마이그레이션 적용(`flywayMigrate` 또는 bootRun 자동 적용)은 **로컬 dev DB 한정 + 사용자 컨펌**(external-infra-safety). 운영 적용은 Round 4 D1.

## 1. 자동화 게이트

```bash
# 백엔드
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
# 프론트
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

모두 GREEN 의무. 특히 `pnpm build` 는 RSC 경계(챕터 목록·삭제 버튼 `'use client'`) 검출.

## 2. 마이그레이션 검증 (US1 — 무손실 이관)

- 마이그레이션 전 기존 작품 본문 글자수·내용 기록 → V14 적용 후 1번 챕터로 동일 내용·`sortOrder=0` 확인.
- 기존 작품마다 챕터 정확히 1개(중복 생성 없음).

## 3. dogfooding 시나리오

| US | 시나리오 | 기대 |
|---|---|---|
| US1 | 작품 열기 → 새 챕터 2개 추가 → 각각 다른 글 작성 → 집필실 나갔다 재진입 | 마지막 본 챕터·내용 복귀 |
| US1 | 챕터 A 에서 한국어 입력 **조합 중** 챕터 B 로 전환 | 조합 자모·문장 유실 0 |
| US2 | 챕터 3개 → 2번 "위로" → 재진입 | 순서 영속 |
| US3 | 챕터 삭제 → 되돌리기 토스트 클릭 | 본문 그대로 복구 |
| US3 | 챕터 1개만 남김 → 삭제 시도 | 버튼 비활성 + (직접 호출 시) 409 거부 |
| US3 | 현재 보는 챕터 삭제 | 인접 챕터 자동 전환(빈 화면 없음) |
| US4 | 챕터 2개에 글 작성 → 대시보드 작품 카드 | 글자수 = 두 챕터 합, 마지막 문장 = 최신 챕터 |
| 양쪽 | 위 전 시나리오 A형(`/projects/[id]/write`)·B형(`/b/works/[id]`) 모두 | 동일 동작 |

## 4. 한국어 IME 4케이스 (PoC 0-1 재사용, 챕터 전환 경로 신설로 의무)

챕터 전환 = 에디터 재마운트 경로가 새로 생기므로 4케이스 회귀 검증:
1. 빠른 타자(조합 중 다음 자모) 2. 조합 중 mark 토글(bold) 3. 한자 변환 4. Backspace 자모 분해
+ **조합 중 챕터 전환 무유실**(본 기능 신규 케이스).

## 5. 회귀 가드 (불변 영역 — 변경 0 확인)

- 016 자동저장 세션(`useDocumentSession`·`draftStore` 키 `wn:draft:doc:{documentId}`) 불변.
- 017 3단 골격·`outlineFromDoc`·접기 토글 불변.
- 대시보드 `ProjectCard` 타입·`ProjectWallCard`·`BWorkMiniCard` 표시 코드 변경 0(백엔드 집계만 교체).
- 기존 409 분기(`DOCUMENT_VERSION_CONFLICT`·`EMAIL_ALREADY_REGISTERED`) 정상 — `LAST_CHAPTER_UNDELETABLE` 추가가 깨뜨리지 않음.
