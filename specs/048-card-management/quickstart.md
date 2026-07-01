# Quickstart & 검증: 카드 관리 (Card Management)

라운드별 게이트 + dogfooding 체크리스트. 시각·상호작용은 단위테스트 미보장(rule 14) → dogfooding 전항을 사용자가 확인한 뒤에만 통과 단정(rule 25).

## R1 BE 게이트 (GREEN)

```
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
```

TDD 대상(유닛/IT):
- [ ] V30 후 기존 보드 카드는 user_id 백필됨(IT: 마이그레이션 + 조회).
- [ ] `GET /api/cards` — 본인 카드만(보드 소속+독립) **생성일 내림차순**(createdAt 포함, 동률 id desc), boardName/linkCount 정확. 타인 카드 미포함.
- [ ] linkCount = distinct 이웃 카드 수(A↔B 양방향 링크 2개여도 이웃 1 → linkCount 1). 링크 없는 카드 0.
- [ ] `POST /api/cards` — 독립 카드 생성(board_id null, user_id=principal). 빈 body 허용. 4종 외 type 400.
- [ ] `PATCH /api/cards/{id}` — 본문/종류 수정(보드 카드·독립 공통).
- [ ] `DELETE /api/cards/{id}` — 삭제 + 걸린 링크 cascade. 타인 404.
- [ ] `PATCH /api/cards/{id}/board` — 붙이기/떼기/옮기기. 연결 있는 카드 400. 타인 대상 보드 400.
- [ ] **기존 보드 캔버스 카드 생성(`POST /api/boards/{boardId}/cards`)이 user_id 를 채움** — NOT NULL 위반 없이 GREEN(회귀 가드).
- [ ] 소유 격리: 모든 카드 엔드포인트가 타인 카드에 404.

> 로컬/운영 DB 마이그레이션 적용은 사용자 컨펌(external-infra-safety). Testcontainers 로 검증. subagent 위임 시 로컬 dev DB 적용 금지 명시 + 완료 후 실제 상태 확인(rule 13).

## R2 FE 데이터 계층 게이트

```
cd frontend && pnpm typecheck && pnpm test && pnpm build
```

- [ ] `lib/api/cards.ts` — 6 함수(list/create/get/update/delete/setBoard) + 타입(CardItem 등). `error.code` 분기(BOARD_OWNER_INVALID 등).
- [ ] `useCards` 훅 — 목록/상세/생성/수정/삭제/재배정. 재배정·떼기·삭제 성공 시 **해당 board `useBoardDetail` + `useBoardsMine` 캐시 invalidate**(캔버스 stale 방지).
- [ ] electron 미러(`lib/electron-api/cards.ts`) 패턴 일치.

## R3 FE UI 게이트

**선행(rule 29)**: `/cards` 목록·상세·생성·진입점 배치를 인터랙티브 목업(`docs/research/YYYY-MM-DD-cards-*-mockup.html`)으로 확정·사용자 승인 후 구현.

```
cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

dogfooding(로컬 BE+DB+FE 3개 기동 필요 — 인증 뒤 화면):
- [ ] 카드 관리 진입점(NAV 또는 확정 위치)으로 `/cards` 진입.
- [ ] 목록: 여러 보드 카드 + 독립 카드가 한 목록. 보드 소속=보드 이름, 독립="속한 보드 없음". **생성일 내림차순**(카드를 편집해도 순서 안 바뀜).
- [ ] 문자열 검색(카드 내용·보드 이름)으로 목록 좁혀짐. 필터(소속: 전체/보드소속/독립, 종류: 인물/장소/사건/주제/무지정) 동작. 검색·필터가 정렬을 바꾸지 않음.
- [ ] 빈 상태(카드 0): 안내 + 새 카드 만들기 유도(화면 컨텍스트 유지 오버레이 — 전체 흰 화면 금지, code-quality §빈 상태).
- [ ] 독립 카드 생성: 본문 입력→저장→즉시 목록. 빈 본문 저장 막힘(FE 가드). **한글 IME 조합 중 Enter 이중 생성 안 됨**(`!e.nativeEvent.isComposing`, code-quality §생성 폼 IME).
- [ ] 카드 상세: 종류(무지정="무지정")·본문 표시. 본문/종류 수정→저장→반영.
- [ ] 삭제: 연결 있는 카드 → "N개의 다른 카드와 연결" 경고 후 확정 시 삭제+연결 사라짐. 연결 없는 카드 → 경고 없이 삭제. 삭제 후 다른 카드/보드 무영향.
- [ ] 재배정: 독립→보드 배정 시 그 보드 캔버스에 나타남. 연결 없는 보드 카드 → 독립으로 떼기/다른 보드로 옮기기. 연결 있는 카드는 재배정 비활성/거부.
- [ ] 교차 확인: `/cards` 에서 재배정/떼기 후 해당 보드 캔버스가 즉시 정합(stale 아님).
- [ ] 회귀: 기존 보드 캔버스(카드 생성·편집·연결·삭제) 무변경 동작.
- [ ] 라이트/다크 + 한국어 본문 표시 확인.

## R4 FE 집필 통합 게이트 (FE-only, 신규 BE 0)

**선행(rule 29)**: 집필 화면 참조 패널 [보드 | 카드] 토글 UI 목업 확정.

```
cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

dogfooding(집필 화면):
- [ ] 집필 화면 "보드 참조" 패널에 [보드 | 카드] 토글. [카드] 전환 시 **그 작품 관련 보드 카드 + 독립 카드**만 모여 보임(다른 작품에만 속한 카드 제외).
- [ ] 카드 뷰가 **이 작품 보드 → 시리즈 보드 → 독립** 3단 그룹, 각 그룹 안 생성일 내림차순.
- [ ] FE 필터 정확: card.boardId ∈ 그 작품 참조 보드(GET /boards/reference) 또는 독립(boardId null)만.
- [ ] 카드 열기 → 상세(종류·내용) 확인(R3 슬라이드오버 재사용).
- [ ] 관련 카드·독립 카드 0 → 빈 상태 안내.
- [ ] 회귀: 기존 "보드 참조"(보드 캔버스·열고닫기 3경로·046 인라인 편집) 무변경.

## 배포

- BE 선행(V30 + 신규 계약) → FE 후행(신규 계약 소비). additive 라 구 프론트 무손상.
- 배포 전 베이스 정합(`git log HEAD..origin/develop`, rule 18) + 운영 Flyway 버전 확인(rule 22).
