/** 기록 화면 진척·작업시간 파생 — desktop `src/lib/progress.ts` 1:1 이식(015 US3). */

/**
 * 진척% 파생 — wordCount ÷ targetLength × 100(반올림). targetLength 가 null/0 이면 null("목표 미설정").
 * 100 초과는 실수치 그대로 반환한다.
 */
export function calcProgress(wordCount: number, targetLength: number | null): number | null {
    if (targetLength === null || targetLength === 0) return null;
    return Math.round((wordCount / targetLength) * 100);
}

/**
 * 총 작업 시간(ms)을 한국어 표시 문자열로 변환한다.
 * 0 이하 → "기록 없음", 시간 없으면 "N분", 시간 있으면 "N시간" 또는 "N시간 M분".
 */
export function formatDuration(ms: number): string {
    if (ms <= 0) return "기록 없음";
    const totalMinutes = Math.floor(ms / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}분`;
    if (minutes === 0) return `${hours}시간`;
    return `${hours}시간 ${minutes}분`;
}
