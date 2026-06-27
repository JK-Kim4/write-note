/**
 * 보드 코치마크 1회성 기억 (045, 트랙 2) — "끌어서 잇기" 첫-진입 안내를 본 적 있는지.
 *
 * 서버 키(SettingsService.ALLOWED)는 값 화이트리스트라 임의 플래그 적재가 불가해 localStorage 로 둔다(FE only, 비파괴).
 * 전역 1회성: 어느 보드에서 처음 연결점에 커서를 올리든 한 번만 안내하고 이후 영영 안 띄운다.
 * 객체 형태로 두어 향후 코치마크 추가 시 키만 늘린다.
 */
const KEY = "writenote.board.coachmark.v1";

type CoachmarkState = { linkHint?: true };

function read(): CoachmarkState {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(KEY);
    if (raw === null) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed as CoachmarkState;
        return {};
    } catch {
        // 손상된 저장값 — 빈 상태로 화해(throw 금지).
        return {};
    }
}

/** "끌어서 잇기" 코치마크를 본 적 있는가(전역 1회성, 기기 단위). */
export function hasSeenLinkHint(): boolean {
    return read().linkHint === true;
}

/** "끌어서 잇기" 코치마크를 봤다고 기록(멱등, 기존 키 보존). */
export function markLinkHintSeen(): void {
    if (typeof localStorage === "undefined") return;
    const state = read();
    state.linkHint = true;
    localStorage.setItem(KEY, JSON.stringify(state));
}
