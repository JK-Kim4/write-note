/**
 * 마지막으로 본 보드 기억 (043 집필 참조, PRD §9) — 작품별 projectId → boardId.
 *
 * 서버 키(SettingsService.ALLOWED)는 값 화이트리스트라 임의 boardId 적재가 불가해 localStorage 로 둔다(비파괴).
 * 작품마다 마지막에 참조한 보드를 기억해 다음 집필 진입 시 기본으로 연다(매번 고르는 마찰 제거).
 */
const KEY = "writenote.board.lastViewed.v1";

type LastViewedMap = Record<string, number>;

function read(): LastViewedMap {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(KEY);
    if (raw === null) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed as LastViewedMap;
        return {};
    } catch {
        // 손상된 저장값 — 빈 맵으로 화해(throw 금지).
        return {};
    }
}

export function getLastViewedBoard(projectId: number): number | null {
    const value = read()[String(projectId)];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function rememberLastViewedBoard(projectId: number, boardId: number): void {
    if (typeof localStorage === "undefined") return;
    if (!Number.isFinite(projectId) || !Number.isFinite(boardId)) return;
    const map = read();
    map[String(projectId)] = boardId;
    localStorage.setItem(KEY, JSON.stringify(map));
}
