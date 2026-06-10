# Data Model: 대시보드 허브 (018, v3)

**DB 스키마 변경 0** — 기존 projects·documents·work_sessions의 읽기 집계만. 본 문서는 신규 응답 모델·클라 뷰 모델·파생 경로를 정의한다(표시값마다 [저장 입력/파생 표시] 분류 — agent-discipline §9).

## 1. 신규 백엔드 응답 모델

### ProjectCardResponse (`model/response/ProjectCardResponse.kt` — 신규)

| 필드 | 타입 | 출처 |
|---|---|---|
| (ProjectResponse 전 필드) | — | `Project` 엔티티(기존 매핑 재사용 — id·title·genre·targetLength·toneNotes·synopsis·worldNotes·nextScene·archivedAt·createdAt·updatedAt) |
| `wordCount` | Int | 1:1 `Document.wordCount` (저장 컬럼) |
| `documentUpdatedAt` | Instant | 1:1 `Document.updatedAt` — "최근에 집필함" 기준 |
| `totalDurationMs` | Long | 그 작품의 종료 세션 `Σ(endedAt − startedAt)` (진행 중 제외 — 기존 규약) |

- 조립: 서비스 3쿼리(활성 작품 → 문서 IN → 종료 세션 IN) 후 projectId 그룹핑. 문서·세션 없음 = 0/생성시각 아님 — 문서는 작품 생성 시 1:1 자동 생성이라 항상 존재(기존 불변식), 세션 없음 = `totalDurationMs 0`.
- `Document.body`(jsonb)는 **미포함** — 페이로드 비대 방지, 마지막 문장은 FE 파생.

### TotalDurationResponse (기존 재사용)

`{ totalDurationMs: Long }` — 기간 합계(BE-1)도 동일 형태.

## 2. FE 타입 (`types/api.ts` · `types/domain.ts` — 변경)

```ts
// types/api.ts — 신규
export interface ProjectCardResponse extends ProjectResponse {
    wordCount: number;
    documentUpdatedAt: string; // ISO8601
    totalDurationMs: number;
}

// types/domain.ts — ProjectCard 재정의
export type ProjectCard = Project & {
    /** 본문 plainText(마지막 문장 파생 원료, FE 파생). 빈 문자열 = 본문 없음. */
    lastSentenceSource: string;
    wordCount: number;
    /** 문서 저장 시각 — 최근작 정렬 키. */
    docUpdatedAt: string;
    totalDurationMs: number;
};
```

- 채움: `electron-api/projects.ts` `listCards()` — 카드 endpoint 1회 + 문서 N병렬(`lastSentenceSource = extractPlainText(doc.body)`).
- 기존 소비처(`projectView.ts`·벽)는 비파괴 — `lastSentenceSource`가 실값이 되며 벽 마지막 문장 회복(US6).

## 3. 대시보드 파생 모델 (`lib/dashboardView.ts` — 신규, 순수)

| 파생값 | 입력 | 규약 |
|---|---|---|
| `selectDashboard(cards)` → `{ resume, others }` | `ProjectCard[]` | `docUpdatedAt` 내림차순(동률 시 `id` 내림차순). `resume` = 첫 번째(빈 배열 → null), `others` = 나머지 |
| `formatRelativeTime(iso, now)` | ISO + 현재 | "방금"(<1분)/"N분 전"/"N시간 전"(<24h)/"N일 전" |
| `startOfWeekMonday(now)` | Date | 로컬 시간대 기준 이번 주 월요일 00:00의 Date — `useWeeklyTotal`이 ISO instant로 변환해 from(=주 시작)/to(=now) 전달 |

- ② 메타 줄 조립: `formatRelativeTime(docUpdatedAt)` + " 저장 · " + `wordCount.toLocaleString()` + "자" + (`totalDurationMs > 0`이면 " · 총 " + `formatDuration(totalDurationMs)`).
- ③ 한 줄: 주간 `totalDurationMs > 0`이면 "이번 주 집필 시간 · " + `formatDuration(...)`, 0이면 미렌더.

## 4. 화면 표시값 ↔ 출처 (확정본)

| 표시값 | 분류 | 출처 |
|---|---|---|
| 인사·날짜 | 클라 정적 | `new Date()` ko-KR, 마운트 후 렌더(R-F5). 이름 없음 |
| 최근작/나머지 | 파생 | `useProjectCards()` → `selectDashboard` |
| 제목/다음 장면 | 저장 입력 | `ProjectCard.title` / `nextScene`(빈 → 줄 숨김) |
| 마지막 문장 | 파생 표시 | `lastSentence(lastSentenceSource)`(기존) — null → "아직 첫 문장을 기다리는 중" |
| "N시간 전 저장" / "N자" / "총 …" | 파생 표시 | `docUpdatedAt`·`wordCount`·`totalDurationMs` — **BE-2 카드 집계** 동봉. 총시간 0 → 토막 숨김 |
| "이번 주 집필 시간" | 파생 표시 | **BE-1 기간 합계** ← `useWeeklyTotal()`(from=`startOfWeekMonday`, to=now). 0 → 줄 숨김 |
| 곁쪽지 | 저장 입력+파생 라벨 | 기존 `useInboxMemos()` 상위 2 + `formatRelativeDay` |

## 5. 쿼리 키 / 캐시

| 키 | 변화 |
|---|---|
| `projectKeys.cards()` | 불변(데이터만 풍부해짐) — 대시보드·벽 공유, 기존 무효화 경로 유효 |
| `["sessions","weeklyTotal",<주 시작 ISO>]` | **신규**(`lib/query/useSessions.ts`) — 주 시작이 키에 포함되어 주가 바뀌면 자연 분리. staleTime은 기본(재진입 시 fresh) |
| `memoKeys.inbox()` | 불변 |

## 6. UI 상태

| 상태 | 형태 | 비고 |
|---|---|---|
| `mounted` | boolean (대시보드 page) | 날짜·상대시각 마운트 게이트 |
| 로딩/에러 | React Query 파생 | 벽 패턴(`.projects-skel`/재시도). 카드·주간 중 하나라도 실패 = 전체 에러(반쪽 렌더 금지) |
| library `mode` | 기존 | 초기값만 `?new=1` → `"create"` (Suspense 내부) |
