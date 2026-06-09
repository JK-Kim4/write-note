/**
 * localStorage 작품별 draft 보존 (016 US1).
 *
 * 타자마다 미동기화 작성분을 작품별 키(`wn:draft:doc:{documentId}`)에 즉시 기록한다.
 * 네트워크 왕복 없이 입력 반응성 확보 + 동기화 전 중단(탭닫기·크래시) 시 작성분 보존.
 * 순수 모듈 — SSR 가드/손상 JSON 방어/용량 초과 삼킴(쓰기 실패가 작성을 막지 않음).
 *
 * SoT: specs/016-autosave-localstorage-redesign/data-model.md §2
 */

export type Draft = {
    documentId: number;
    projectId: number;
    /** TipTap/ProseMirror JSON 직렬화(작가 최신 입력). */
    body: string;
    /** 이 draft 가 출발한 서버 version(ISO8601 불투명 토큰). */
    baseVersion: string;
    /** 미동기화 변경 존재 여부. */
    dirty: boolean;
    /** draft 기록 시각(epoch ms, 표시·정리용). */
    updatedAt: number;
};

const keyFor = (documentId: number): string => `wn:draft:doc:${documentId}`;

/** draft 기록. localStorage 불가(SSR·비활성·용량 초과) 시 실패를 삼킨다(작성 차단 금지). */
export function writeDraft(draft: Draft): void {
    if (typeof localStorage === "undefined") return;
    try {
        localStorage.setItem(keyFor(draft.documentId), JSON.stringify(draft));
    } catch {
        // 용량 초과·비활성 등 — 서버 저장 경로는 정상 동작하므로 조용히 무시.
    }
}

/** draft 조회. 없거나 손상된 JSON 은 draft 없음(null)으로 간주. */
export function readDraft(documentId: number): Draft | null {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(keyFor(documentId));
    if (raw === null) return null;
    try {
        return JSON.parse(raw) as Draft;
    } catch {
        return null;
    }
}

/** draft 삭제. */
export function clearDraft(documentId: number): void {
    if (typeof localStorage === "undefined") return;
    try {
        localStorage.removeItem(keyFor(documentId));
    } catch {
        // 무시.
    }
}
