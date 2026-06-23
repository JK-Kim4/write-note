/**
 * 자체 엔진 챕터 에디터 ↔ 셸/페이지 결선 타입 (024 R6 — TipTap 폐기 시 BChapterEditor 에서 이관).
 *
 * BStudioShell · BCustomChapterEditor · A형 집필실(projects/[id]/write)이 공유한다.
 * 이름은 하위 호환을 위해 `BChapterEditor*` 접두사를 유지(원천이 BChapterEditor 였음).
 */

import type { SyncStatus } from "@/hooks/useDocumentSession";

/** 저장 상태 / flush 통로를 page·셸로 전달 (저장 표시 + 챕터 전환 직전 flush + 이탈 동기 저장). */
export interface BChapterEditorSyncStatus {
    syncStatus: SyncStatus;
    flushDraft: (body: string) => void;
    /** 이탈(작품 목록/작업 종료) 직전 미동기화분을 서버에 저장하고 완료를 await — 셸이 네비 전에 호출. */
    flushNow: () => Promise<void>;
}

/** 충돌(409) 상태 / 해결 핸들러 — page·셸이 충돌 다이얼로그를 렌더. */
export interface BChapterEditorConflictHandlers {
    conflict: { currentVersion: string; currentBody: string } | null;
    reload: () => void;
    overwrite: () => void;
}
