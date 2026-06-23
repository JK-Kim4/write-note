/**
 * 집필 시간(ms)을 한국어 표기로 변환. 로그 화면·라이브러리 카드·시리즈 타일 공통.
 * - 0ms → "0분"
 * - 0 < ms < 60_000 → "1분 미만"
 * - 분만 → "N분"
 * - 시간만 → "N시간"
 * - 시간+분 → "N시간 M분"
 */
export function formatDurationKo(ms: number): string {
    const minutes = Math.floor(ms / 60_000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0 && m === 0) return ms > 0 ? "1분 미만" : "0분";
    if (h === 0) return `${m}분`;
    if (m === 0) return `${h}시간`;
    return `${h}시간 ${m}분`;
}
