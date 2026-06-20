# Quickstart: 대시보드 허브 (018, v3)

## 환경

- **BE**: `cd backend`. local DB `docker compose up -d --wait postgres`. 테스트는 Testcontainers(기존 패턴).
- **FE**: Node 24.14.0 + pnpm 8.15.5(corepack). `cd frontend`. dev `pnpm dev`(기존 3000 재사용, 중복 기동 금지).

## implement 진입 전 게이트 (순서대로)

1. **tasks.md 정합 grep**(룰 §6): 명시 파일·클래스·메서드 실제 존재 확인 — BE `grep -rn "WorkSessionService\|ProjectService\|TotalDurationResponse" backend/src/main/kotlin | head` / FE `grep -rn "listCards\|useProjectCards\|useInboxMemos\|formatDuration" frontend/src/lib | head`.
2. **Next 문서 정독**(AGENTS.md): `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`(전례: `src/app/auth/verify/page.tsx`).
3. **Kotlin annotation 배열 인자 grep**(룰): `grep -rn "rollbackFor" backend/src/main/kotlin | head` — `[Exception::class]` 패턴 정합.
4. 기준선: FE `node_modules/.bin/vitest run`(103 pass) · `tsc --noEmit`(기존 1건) · `eslint src`(기존 1건) / BE `./gradlew test`(GREEN).

## TDD 순서 (RED→GREEN, 한 번에 하나)

**백엔드 먼저(FE shim이 계약 소비자):**

1. `WorkSessionService` 단위 — rangeTotal: 범위 합산/경계(from 포함·to 제외)/진행 중 제외/타 사용자 제외/빈 0/`from>=to` 오류 → 구현 GREEN.
2. `WorkSessionTotalController` IT — 200/400/401 → GREEN.
3. `ProjectService.listCards` 단위 — 조립 정확성/세션 0/아카이브 제외/타 사용자 제외 → GREEN (3쿼리 일괄 — SQL N+1 금지).
4. `ProjectController` `/cards` IT — 200 필드·빈 배열·401 + **기존 목록·작품별 total 회귀 무변화** → GREEN.

**프론트엔드:**

5. `lib/dashboardView.test.ts` — selectDashboard(빈/1편/정렬/동률 id)·formatRelativeTime·startOfWeekMonday(주중/월요일 당일/일요일) → GREEN.
6. `electron-api/projects.test.ts` 확장 — listCards(카드+문서 채움, 한 조회 실패 시 전체 reject) / `sessions` rangeTotal → GREEN.
7. `components/dashboard/*.test.tsx` — ResumeCard(빈 본문/다음 장면 숨김/총시간 0 숨김)·WorkMiniCard → GREEN.
8. `app/page.test.tsx` — 5블록·이번 주 줄(있음/0 숨김)·빈 상태·진입 동작(쿼리 mock) → GREEN.
9. `app/library/page.test.tsx` — `?new=1` create + 렌더 스모크 → GREEN. Rail은 page RTL 네비 단언.

## 검증 게이트 (전부 포어그라운드)

```bash
# BE
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build

# FE
cd frontend
node_modules/.bin/vitest run          # 전체 GREEN
npx tsc --noEmit                      # 기존 documents.test.ts 1건 외 0
node_modules/.bin/eslint src          # 신규 0 경고 (기존 page.tsx:107 1건 외)
pnpm build                            # RSC — 신규/변경 page 작성 직후 즉시 1회 + 최종 1회
```

## 시각 검증

- 목업 대조: `docs/design/web/mockups/dashboard-reentry-hub.html` — v3은 ghost 자리에 "이번 주" 한 줄(조용한 텍스트, 점선 박스 아님).
- headless Chrome 스크린샷: 라이트(`--blink-settings=preferredColorScheme=1`)/다크 × 작품 있음/0편 × 곁쪽지 0 × 이번 주 0(줄 숨김 확인).
- 대비 AA·포커스 가시·reduced-motion.

## 라이브 dogfooding (사용자 영역)

- `/` 최근작 타일 → 1클릭 집필 재진입 / "이번 주 집필 시간" 수치가 기록 화면 감각과 일치하는지.
- `/library` 벽 전 기능 + 마지막 문장 회복.
- 로그인 직후·"작업 종료" 직후 홈 귀환.

## 주의 (회귀 지뢰)

- `useSearchParams`는 Suspense 경계 내부 필수 — `pnpm build`에서 prerender 경고 확인.
- 날짜·상대시각 마운트 게이트 — hydration mismatch 콘솔 에러 0.
- listCards 부분 성공 배열 반환 금지(반쪽 렌더 방지).
- 기존 `GET /api/projects`·작품별 total 계약 불변(BE IT로 보호).
- Kotlin `@Transactional(readOnly = true)`·배열 인자 `[X::class]`·ktlint main+test 양쪽.
- 기존 무관 부채(`documents.test.ts`·집필 page lint) 건드리지 말 것.
