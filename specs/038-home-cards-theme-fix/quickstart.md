# Quickstart / 검증 절차: 038

로컬 dogfooding은 백엔드+DB 필요(메모리 [[local-dogfooding-needs-backend]]): `docker compose up -d --wait postgres` → `cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'` → `cd frontend && pnpm dev`.

## US1 — 홈 작품 카드

### 자동 검증
- 백엔드: `cd backend && ./gradlew test` — 시리즈명 매핑/미분류 null/일괄 조회 테스트 GREEN.
- 프론트: `cd frontend && pnpm test` — `selectDashboard` 정렬/others, "더 보기" 조건(>2), 카드 표시(시리즈/수정일) 테스트 GREEN.
- 게이트: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

### dogfooding (작품 4개 이상 계정)
1. 홈 진입 → "이어서 쓰기" 1개 + 아래 카드 **정확히 2개** + "더 보기" 노출.
2. 각 카드에 제목·시리즈명(미분류는 "미분류")·마지막 작성 내용·최종 수정일·목표 게이지 표시.
3. 카드 호버 → 생성일·총 집필 시간 1초 이내 표시.
4. "더 보기" 클릭 → 작품 보관함(`/library`) 이동.
5. 작품 ≤ 3개 계정: "더 보기" 미노출. 작품 1개: 아래 카드 영역 비고 오류 없음.

## US2 — 새 디자인 다크모드

### 게이트 0 (목업) — 구현 전 필수
- `docs/research/2026-06-24-bdesign-dark-mockup.html`로 홈·마이페이지 다크 팔레트·회색 계조·대비 시안 제시 → **사용자 승인**. 승인 전 색상 치환 착수 금지.

### 자동 검증
- `cd frontend && pnpm lint && pnpm typecheck && pnpm build`(RSC 경계). 색상은 단위테스트로 시각 미보장(CLAUDE.md §14) — 빌드/타입만.

### dogfooding (라이트/다크 양쪽 + 한국어)
1. 마이페이지 설정 → 다크 선택 → **홈·마이페이지 화면 즉시 다크 전환**(추가 새로고침 불필요, SC-004).
2. 라이트로 되돌리면 즉시 라이트. 새로고침 후 마지막 선택 유지.
3. 한국어 본문 1문단이 라이트/다크 양쪽에서 가독(폰트 fallback·대비 AA) — CLAUDE.md 한국어 검증 cadence.
4. 회귀: 기존 다크 동작 화면(A 디자인 집필실)·라이트 외관에 깨짐 없음.

## 배포 순서
- US1: 백엔드(categoryName) 선행 배포 → 프론트 후행(없어도 "미분류" fallback이라 안전).
- US2: 프론트 단독(백엔드 0). 목업 승인 후 구현.
