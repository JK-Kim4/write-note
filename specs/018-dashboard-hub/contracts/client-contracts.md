# Client Contracts: 대시보드 허브 (018)

외부(백엔드) API 신규·변경 0 — 본 계약은 클라이언트 내부 모듈 경계다. 소비처가 내부 구현을 모르고 쓸 수 있는 형태로 박는다.

## 1. `webElectronApi.projects.listCards()` (변경 — `lib/electron-api/projects.ts`)

```ts
listCards(): Promise<ProjectCard[]>
```

- **동작**: `listProjects({size:100})` 후 작품별 `Promise.all([getProjectDocument(id), apiFetch(GET /api/projects/{id}/work-sessions/total)])` 병렬 → `lastSentenceSource = extractPlainText(doc.body)`, `wordCount = doc.wordCount`, `docUpdatedAt = doc.updatedAt`, `totalDurationMs = total.totalDurationMs`.
- **실패**: 어느 한 조회라도 실패하면 전체 reject(부분 성공 배열 반환 금지) — 화면은 기존 에러 패턴(안내+재시도). `logs.list()`와 동일 규약.
- **소비처**: `useProjectCards()`(불변) → 대시보드 page · 벽 page(`/library`).

## 2. `lib/dashboardView.ts` (신규 — 순수함수, DOM/시계 비의존)

```ts
export function selectDashboard(cards: ReadonlyArray<ProjectCard>): {
    resume: ProjectCard | null;   // docUpdatedAt 최신(동률 시 id 큰 쪽). 빈 배열 → null
    others: ProjectCard[];        // resume 제외, docUpdatedAt 내림차순
};

export function formatRelativeTime(iso: string, now: Date): string;
// <60초 "방금" / <60분 "N분 전" / <24시간 "N시간 전" / 그 외 "N일 전"
```

- `now`는 인자 주입(테스트 결정성). 시간 단위 외 포맷(`formatRelativeDay`·`formatDuration`)은 기존 모듈 재사용 — 본 모듈이 재정의하지 않는다.

## 3. 컴포넌트 계약 (`components/dashboard/` — 신규, 전부 `'use client'` 표시 전용)

```ts
// ResumeCard — ② 이어서 쓰기 타일. 데이터는 전부 props, fetch/훅 없음.
type ResumeCardProps = {
    card: ProjectCard;
    onOpen: () => void;          // 타일·버튼 공통 — /projects/{id}/write 이동은 부모 책임
};
// 내부 표시 규약: lastSentence(card.lastSentenceSource) null → "아직 첫 문장을 기다리는 중" /
// nextScene 빈 문자열 → 줄 숨김 / totalDurationMs 0 → "총 …" 토막 숨김

// WorkMiniCard — ③ 작품 미니 카드.
type WorkMiniCardProps = {
    card: ProjectCard;
    onOpen: () => void;
};
// 표시: 제목 + 마지막 문장 최대 2줄 클램프(빈 본문 → 동일 placeholder 카피)
```

- 곁쪽지 카드(④)·인사(①)·빈 상태는 대시보드 page 직접 구성(분리 과설계 — plan Structure Decision).

## 4. 라우트·네비 계약

| 경로 | 계약 |
|---|---|
| `/` | 대시보드(인증 필수 — `useAuthGuard("requireAuth")`). 읽기 전용 + 진입 동작만 |
| `/library` | 기존 작품 벽 전 기능 불변(목록·새 작품·다음 장면 인라인·삭제) |
| `/library?new=1` | 새 작품 폼이 열린 벽 — `useSearchParams`는 Suspense 경계 내부에서만 호출(`auth/verify` 전례 패턴) |
| Rail | "홈"(신규, `href:"/"`, `match: p === "/"`) / "작품"(`href:"/library"`, `match: p.startsWith("/library")`) / 집필 fallback `push("/")` 유지 / 메모·기록·문의·잉크 불변 |
| 집필 page 오류 동선 | "작품 벽으로" 버튼 → `push("/library")` (1줄 변경). 작업 종료 후 `push("/")`(대시보드 귀환)·로그인 후·가드 리다이렉트는 불변 |

## 5. 진입 동작 시맨틱 (접근성 계약)

- 모든 진입(타일·버튼·미니 카드·곁쪽지 카드·"+ 새 작품")은 button 또는 link 시맨틱 + 가시 포커스 + 키보드 실행 가능.
- 등장 애니메이션은 `prefers-reduced-motion: reduce`에서 제거.
- 텍스트 대비 AA(`--muted` 포함 ≥4.5:1).
