# Quickstart: 대시보드 허브 (018)

## 환경

- Node 24.14.0 + pnpm 8.15.5(corepack). 작업 디렉터리 `frontend/`.
- dev: `pnpm dev` (포트 3000 — 같은 디렉터리 dev 중복 기동 금지, 기존 3000 재사용).

## implement 진입 전 게이트 (순서대로)

1. **tasks.md 정합 grep**(룰 §6): 명시된 파일·클래스·훅 이름 실제 존재 확인 — `grep -rn "listCards\|useProjectCards\|useInboxMemos\|formatDuration\|formatRelativeDay" src/lib | head`.
2. **Next 문서 정독**(AGENTS.md): `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` — Suspense 경계 요건 확인(전례: `src/app/auth/verify/page.tsx`).
3. 기존 게이트 기준선 확인: `node_modules/.bin/vitest run`(현재 103 pass) · `tsc --noEmit`(기존 `documents.test.ts` 1건만 — 무시 대상) · `eslint src`(기존 집필 page 1건만).

## TDD 순서 (RED→GREEN, 한 번에 하나)

1. `lib/dashboardView.test.ts` — selectDashboard(빈 배열/1편/정렬/동률 id 2차 키) · formatRelativeTime(방금/분/시간/일) → `lib/dashboardView.ts` GREEN.
2. `lib/electron-api/projects.test.ts` 확장 — listCards 집계(문서+total 채움, 한 조회 실패 시 전체 reject) → `listCards` GREEN. 기존 mock 패턴(같은 파일) 준수.
3. `components/dashboard/*.test.tsx` → ResumeCard(빈 본문/다음 장면 숨김/총시간 0 숨김)·WorkMiniCard GREEN.
4. `app/page.test.tsx` — 4블록·빈 상태(작품 0/곁쪽지 0)·진입 동작(쿼리 mock) → 대시보드 page GREEN.
5. `app/library/page.test.tsx` — `?new=1` create 모드 + 렌더 스모크 → library 이동 GREEN.
6. Rail 재편은 page RTL 네비 단언으로 커버.

## 검증 게이트 (전부 포어그라운드)

```bash
cd frontend
node_modules/.bin/vitest run          # 전체 GREEN (기존 103 + 신규)
npx tsc --noEmit                      # 기존 documents.test.ts 1건 외 0
node_modules/.bin/eslint src          # 신규 파일 0 경고 (기존 page.tsx:107 1건 외)
pnpm build                            # RSC 경계 — 신규/변경 page 작성 직후 즉시 1회 + 최종 1회
```

## 시각 검증

- 정적 목업 대조: `docs/design/web/mockups/dashboard-reentry-hub.html`(ghost 타일 제외가 정답 상태).
- headless Chrome 스크린샷: 라이트(`--blink-settings=preferredColorScheme=1`)/다크 × 작품 있음/0편 × 곁쪽지 있음/0장.
- 확인 항목: 웜 토큰 계승(잉크블루 accent·크림 종이)·세리프 인용 톤·대비 AA·포커스 가시·reduced-motion 시 등장 애니메이션 제거.

## 라이브 dogfooding (사용자 영역)

- `/` 진입 → 최근작 타일 맥락(제목·마지막 문장·다음 장면·메타) → [이어서 쓰기] 1클릭 재진입.
- `/library` 벽 전 기능(새 작품·다음 장면 인라인·삭제) + 마지막 문장 회복 확인.
- 로그인 직후·집필 "작업 종료" 직후 홈 귀환 흐름.

## 주의 (회귀 지뢰)

- `?new=1`: `useSearchParams`는 반드시 Suspense 경계 내부 — 빌드는 통과해도 prerender 경고/런타임 이슈는 `pnpm build`에서 확인.
- 날짜·상대시각은 마운트 후 렌더(research R5) — hydration mismatch 콘솔 에러 0 확인.
- `listCards` 실패 규약: 부분 성공 배열 반환 금지(반쪽 렌더 방지).
- 기존 무관 부채(`documents.test.ts` typecheck·집필 page lint) 건드리지 말 것.
