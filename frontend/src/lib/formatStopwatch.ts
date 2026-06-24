/** 경과 밀리초를 "HH:MM:SS" 로 포맷(스톱워치 표시용). 음수는 0 으로 가드. */
export function formatStopwatch(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
