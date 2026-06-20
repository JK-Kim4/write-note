/**
 * 오늘 작업시간 원통형 게이지 파생(028 US2) — 순수함수(시계·DOM 비의존).
 * 데이터는 기존 주간 집계 dayMs[today] 를 재사용한다(신규 fetch 0).
 */

const MINUTE_MS = 60_000;

/** 오늘/목표 채움 비율(0~1, clamp). 0·NaN·음수·목표≤0 은 안전하게 0(SC-006 NaN 가드). */
export function gaugeFill(todayMs: number, goalMinutes: number): number {
    if (!Number.isFinite(todayMs) || todayMs <= 0) return 0;
    const goalMs = goalMinutes * MINUTE_MS;
    if (goalMs <= 0) return 0;
    return Math.min(todayMs / goalMs, 1);
}

/** 작업시간 ms → 분(내림). 결측/NaN 은 0. */
export function todayMinutes(todayMs: number): number {
    if (!Number.isFinite(todayMs) || todayMs <= 0) return 0;
    return Math.floor(todayMs / MINUTE_MS);
}

/** 분 → 한국어 표기("30분" / "1시간" / "1시간 30분" / "0분"). */
export function formatDurationMinutes(totalMinutes: number): string {
    const m = Math.max(0, Math.floor(totalMinutes));
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    if (hours === 0) return `${mins}분`;
    if (mins === 0) return `${hours}시간`;
    return `${hours}시간 ${mins}분`;
}

/** 오늘 작업시간 ms → "1시간 2분 30초" 표기(0 단위 생략, 0이면 "0초"). 게이지의 '오늘' 값 표시용. */
export function formatTodayDuration(todayMs: number): string {
    const totalSec = !Number.isFinite(todayMs) || todayMs <= 0 ? 0 : Math.floor(todayMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}시간`);
    if (mins > 0) parts.push(`${mins}분`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}초`);
    return parts.join(" ");
}

/** 오늘 작업시간이 목표 이상인가. */
export function isGoalReached(todayMs: number, goalMinutes: number): boolean {
    return todayMinutes(todayMs) >= goalMinutes;
}
