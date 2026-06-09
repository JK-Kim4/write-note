/**
 * 마지막으로 연 작품 기억 (015 Rail "집필" 네비 보조).
 *
 * web 은 desktop 과 달리 전역 "현재 작품" 상태가 없다. Rail 의 "집필" 항목이 의미를 가지려면
 * 마지막으로 집필실에 들어간 작품을 기억해 그 작품의 집필실로 보낸다(없으면 작품 벽).
 */
const KEY = "wn:lastProjectId";

export function rememberLastProject(id: number): void {
    if (typeof localStorage !== "undefined" && Number.isFinite(id)) {
        localStorage.setItem(KEY, String(id));
    }
}

export function getLastProject(): number | null {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}
