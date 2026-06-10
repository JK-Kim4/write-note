/**
 * 대시보드(018) 파생 — 순수함수(DOM/시계 비의존, now 주입).
 * 최근작 선정·정렬과 시간 단위 상대 포맷. 일 단위 상대 날짜는 기존 relativeDate.ts,
 * 작업시간 포맷은 기존 progress.ts 를 재사용한다 — 여기서 재정의하지 않는다.
 */
import type { ProjectCard } from "@/lib/types/domain";

/**
 * 최근작 = 문서 저장 시각(`docUpdatedAt`) 최신(동률 시 id 큰 쪽 — 결정적).
 * resume 제외 나머지는 같은 기준 내림차순.
 */
export function selectDashboard(cards: ReadonlyArray<ProjectCard>): {
    resume: ProjectCard | null;
    others: ProjectCard[];
} {
    const sorted = [...cards].sort((a, b) => {
        if (a.docUpdatedAt !== b.docUpdatedAt) return a.docUpdatedAt < b.docUpdatedAt ? 1 : -1;
        return b.id - a.id;
    });
    const [resume = null, ...others] = sorted;
    return { resume, others };
}

/**
 * "이번 주" 경계(018 US3) — 사용자 로컬 시간대 기준 이번 주 월요일 00:00.
 * 일요일은 주의 마지막 날(한국 관례). 기간 합계 from 으로 ISO 변환해 쓴다.
 */
export function startOfWeekMonday(now: Date): Date {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = start.getDay(); // 0=일 … 6=토
    const daysSinceMonday = (day + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
    return start;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** "N시간 전 저장" 표시용 — 방금(<1분) / N분 전 / N시간 전(<24h) / N일 전. */
export function formatRelativeTime(iso: string, now: Date): string {
    const diff = now.getTime() - new Date(iso).getTime();
    if (diff < MINUTE_MS) return "방금";
    if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}분 전`;
    if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}시간 전`;
    return `${Math.floor(diff / DAY_MS)}일 전`;
}
