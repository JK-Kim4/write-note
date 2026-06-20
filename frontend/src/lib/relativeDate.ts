/** 상대 날짜 라벨 — desktop `src/lib/relativeDate.ts` 1:1 이식(015 US2). */
const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * ISO 시각을 현재 기준 한국어 일단위 상대 라벨로 변환한다.
 * 달력일 차이 기준 — 시·분 단위는 다루지 않는다(일 단위로 충분).
 */
export function formatRelativeDay(iso: string, now: Date): string {
    const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS);
    if (days <= 0) return "오늘";
    if (days === 1) return "어제";
    if (days < 7) return `${days}일 전`;
    return `${Math.floor(days / 7)}주 전`;
}
