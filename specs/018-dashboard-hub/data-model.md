# Data Model: 대시보드 허브 (018)

영속 모델 변경 0(백엔드·DB 무변경). 본 문서는 클라이언트 뷰 모델 확장과 파생 경로를 정의한다. 표시값마다 [저장 입력 / 파생 표시] 분류를 명시한다(agent-discipline §9).

## 1. ProjectCard 확장 (`lib/types/domain.ts` — 변경)

```ts
/** 작품 벽/홈 카드용 — 작품 + 본문·세션에서 파생한 표시값(클라 집계, 014 R6). */
export type ProjectCard = Project & {
    /** 본문 plainText(마지막 문장 파생 원료). 빈 문자열 = 본문 없음. */
    lastSentenceSource: string;
    /** 문서 글자수(document.wordCount). */
    wordCount: number;
    /** 문서 저장 시각(document.updatedAt, ISO8601) — "최근에 집필함"의 기준. */
    docUpdatedAt: string;
    /** 작품별 누적 작업시간(ms) — work-sessions/total. 0 = 측정된 세션 없음. */
    totalDurationMs: number;
};
```

- 채움 주체: `electron-api/projects.ts`의 `listCards()` (작품별 `[getProjectDocument, work-sessions/total]` 병렬 fetch — contracts §1).
- 기존 소비처 영향: `projectView.ts`(`toProjectCardView`)·벽 page는 추가 필드를 무시 — 비파괴. `lastSentenceSource`가 실제 값으로 채워지며 벽 마지막 문장이 회복된다(US4).

## 2. 대시보드 파생 모델 (`lib/dashboardView.ts` — 신규, 순수)

| 파생값 | 입력 | 규약 |
|---|---|---|
| `selectDashboard(cards)` → `{ resume, others }` | `ProjectCard[]` | `docUpdatedAt` 내림차순(동률 시 `id` 내림차순). `resume` = 첫 번째(없으면 null), `others` = 나머지(정렬 유지) |
| `formatRelativeTime(iso, now)` | ISO8601 + 현재 시각 | "방금"(<1분) / "N분 전" / "N시간 전"(<24h) / "N일 전" |

- 이어서 쓰기 메타 줄 조립: `formatRelativeTime(docUpdatedAt) + " 저장 · " + wordCount.toLocaleString() + "자"` + (`totalDurationMs > 0`이면 `" · 총 " + formatDuration(totalDurationMs)`).

## 3. 화면 표시값 ↔ 출처 매핑 (설계 §2 확정본)

| 표시값 | 분류 | 출처 (필드/함수) |
|---|---|---|
| 인사·날짜 | 클라 정적 | `new Date()` ko-KR 포맷, **마운트 후 렌더**(research R5). 이름 없음(데이터 부재) |
| 최근작/나머지 | 파생 | `useProjectCards()` → `selectDashboard` |
| 제목 / 다음 장면 | 저장 입력 | `ProjectCard.title` / `ProjectCard.nextScene`(빈 문자열 → 줄 숨김) |
| 마지막 문장 | 파생 표시 | `lastSentence(card.lastSentenceSource)`(기존 `lib/lastSentence.ts`) — null → "아직 첫 문장을 기다리는 중" |
| "N시간 전 저장" | 파생 표시 | `docUpdatedAt` → `formatRelativeTime` |
| "N자" | 파생 표시 | `wordCount` |
| "총 N시간 M분" | 파생 표시 | `totalDurationMs` → 기존 `formatDuration`(`lib/progress.ts`). 0 → 토막 숨김 |
| 곁쪽지 본문/날짜 | 저장 입력 + 파생 라벨 | `useInboxMemos()` → `capturedAt` 내림차순 상위 2 + 기존 `formatRelativeDay` |

## 4. 쿼리 키 / 캐시 영향

| 키 | 변화 |
|---|---|
| `projectKeys.cards()` | **불변** — 같은 키로 채워진 데이터가 풍부해질 뿐. 대시보드·벽이 공유(이동 시 재호출 없음). 기존 무효화 경로(`projectKeys.all`) 그대로 유효 |
| `memoKeys.inbox()` | 불변 — 대시보드가 추가 소비만 |
| 신규 키 | 없음 |

## 5. UI 상태 (대시보드 page 로컬)

| 상태 | 형태 | 비고 |
|---|---|---|
| `mounted` | boolean | research R5 — 날짜·상대시각 마운트 게이트 |
| 로딩/에러 | React Query 파생 | 벽과 동일 패턴(`.projects-skel` / 안내+재시도). 부분 실패 = 전체 에러(반쪽 렌더 금지, spec Edge Case) |

library page: `mode` 초기값 = `useSearchParams().get("new") === "1" ? "create" : "list"` (이후 동작 기존과 동일).
