# Client Contracts: 대시보드 허브 (018, v3)

FE 내부 모듈 경계 계약. 신규 외부 계약은 `backend-api.md`가 정본 — 본 문서의 shim·훅은 그 소비자다.

## 1. `webElectronApi.projects.listCards()` (변경 — `lib/electron-api/projects.ts`)

```ts
listCards(): Promise<ProjectCard[]>
```

- **동작**: ① `GET /api/projects/cards`(어댑터 `lib/api/projects.ts`의 신규 `listProjectCards()`) ② 작품별 `getProjectDocument(id)` 병렬 → `lastSentenceSource = extractPlainText(doc.body)` 채움.
- **실패**: 어느 조회라도 실패 시 전체 reject(부분 성공 배열 금지) — 화면은 기존 에러 패턴(안내+재시도).
- **소비처**: `useProjectCards()` 불변 → 대시보드·벽(`/library`).

## 2. `webElectronApi.sessions.rangeTotal()` (추가 — `lib/electron-api/sessions.ts`)

```ts
rangeTotal(fromIso: string, toIso: string): Promise<{ totalDurationMs: number }>
// GET /api/work-sessions/total?from=&to= 호출. ISO instant 문자열 전달.
```

## 3. `lib/query/useSessions.ts` (신규)

```ts
export function useWeeklyTotal(now?: Date): UseQueryResult<{ totalDurationMs: number }>
// from = startOfWeekMonday(now).toISOString(), to = now.toISOString()
// queryKey = ["sessions", "weeklyTotal", <from ISO>] — 주가 바뀌면 키 자연 분리
```

## 4. `lib/dashboardView.ts` (신규 — 순수, DOM/시계 비의존)

```ts
export function selectDashboard(cards: ReadonlyArray<ProjectCard>): {
    resume: ProjectCard | null;   // docUpdatedAt 최신(동률 시 id 큰 쪽). 빈 배열 → null
    others: ProjectCard[];        // resume 제외, docUpdatedAt 내림차순
};
export function formatRelativeTime(iso: string, now: Date): string;
// <60초 "방금" / <60분 "N분 전" / <24시간 "N시간 전" / 그 외 "N일 전"
export function startOfWeekMonday(now: Date): Date;
// 로컬 시간대 기준 이번 주 월요일 00:00:00.000
```

- `now` 인자 주입(테스트 결정성). `formatRelativeDay`·`formatDuration`은 기존 모듈 재사용 — 재정의 금지.

## 5. 컴포넌트 계약 (`components/dashboard/` — 신규, `'use client'`, 표시 전용)

```ts
type ResumeCardProps = { card: ProjectCard; onOpen: () => void };
// 표시 규약: lastSentence(lastSentenceSource) null → "아직 첫 문장을 기다리는 중" /
// nextScene 빈 문자열 → 줄 숨김 / totalDurationMs 0 → "총 …" 토막 숨김 / 이동은 부모 책임

type WorkMiniCardProps = { card: ProjectCard; onOpen: () => void };
// 제목 + 마지막 문장 최대 2줄 클램프(빈 본문 → 동일 placeholder 카피)
```

- 인사(①)·"이번 주" 한 줄(③)·곁쪽지 카드(⑤)·빈 상태는 대시보드 page 직접 구성.

## 6. 라우트·네비 계약

| 경로 | 계약 |
|---|---|
| `/` | 대시보드(`useAuthGuard("requireAuth")`). 읽기 전용 + 진입 동작만. ③ 한 줄은 주간 0이면 미렌더 |
| `/library` | 기존 작품 벽 전 기능 불변 |
| `/library?new=1` | 새 작품 폼 열린 벽 — `useSearchParams`는 Suspense 경계 내부(`auth/verify` 전례) |
| Rail | "홈"(신규, `/`, `p === "/"`) / "작품"(`/library`, `p.startsWith("/library")`) / 집필 fallback `push("/")` 유지 / 나머지 불변 |
| 집필 page | 에러 "작품 벽으로" → `push("/library")`(1줄). 작업 종료 후 `push("/")`·로그인·가드 불변 |

## 7. 접근성·표시 계약

- 모든 진입 = button/link 시맨틱 + 가시 포커스 + 키보드 실행. `prefers-reduced-motion`에서 등장 애니메이션 제거. 텍스트 대비 AA(`--muted` 포함).
- `new Date()` 의존 표시(① 날짜·② 상대시각)는 마운트 후 렌더(hydration mismatch 0).
