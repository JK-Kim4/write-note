"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import { documentKeys, useChapterDocument } from "@/lib/query/useDocument";
import type { ProjectDocument } from "@/lib/types/domain";
import { useDocumentSession, type SyncStatus } from "@/hooks/useDocumentSession";
import { BEditor } from "@/components/b/BEditor";
import type { DocumentChange } from "@/components/editor/PaperEditor";
import type { PaperSize } from "@/components/editor/pageLayout";

/**
 * B형 단일 챕터 편집 세션 컴포넌트 (022 방안 A).
 *
 * `BWorkDetailPage` 에서 `<BChapterEditor key={currentChapterId} />` 로 사용하면
 * 챕터 전환 시 리마운트 → 새 useDocumentSession 인스턴스 → versionRef 새 챕터 토큰 초기화.
 * → 거짓 409 충돌 해결.
 *
 * 016 보증:
 * - IME 조합 중 무유실: 전환 직전 page 에서 flushDraft 호출 (onSyncStatus 콜백으로 전달).
 * - localStorage-first 자동복원·draft 키 격리는 useDocumentSession 이 보장.
 * - 충돌(409) 다이얼로그는 page 에서 렌더 — conflict 상태 / 해결 콜백을 onConflict 로 올림.
 */

export interface BChapterEditorSyncStatus {
    syncStatus: SyncStatus;
    flushDraft: (body: string) => void;
}

export interface BChapterEditorConflictHandlers {
    conflict: { currentVersion: string; currentBody: string } | null;
    reload: () => void;
    overwrite: () => void;
}

interface BChapterEditorProps {
    documentId: number;
    projectId: number;
    paperSize: PaperSize;
    /** 저장 상태 / flushDraft 를 page 로 전달 (Titlebar 저장 표시 + 챕터 전환 직전 flush). */
    onSyncStatus: (status: BChapterEditorSyncStatus) => void;
    /** 충돌 상태 / 해결 핸들러를 page 로 전달 — page 가 충돌 다이얼로그를 렌더. */
    onConflict: (handlers: BChapterEditorConflictHandlers) => void;
    /** 에디터 인스턴스를 page 로 올려 목차 파생에 사용. */
    onEditorReady: (editor: Editor | null) => void;
}

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [] });

export function BChapterEditor({
    documentId,
    projectId,
    paperSize,
    onSyncStatus,
    onConflict,
    onEditorReady,
}: BChapterEditorProps) {
    const queryClient = useQueryClient();
    const { data: doc, isLoading, isError } = useChapterDocument(documentId);

    const [body, setBody] = useState<string | null>(null);
    // 같은 챕터 내 reload / overwrite 시 BEditor 강제 리마운트용.
    const [editorKey, setEditorKey] = useState(0);

    const session = useDocumentSession({
        documentId: doc?.id ?? 0,
        projectId,
        serverBody: doc?.bodyJson ?? EMPTY_DOC,
        serverVersion: doc?.version ?? "",
        body: body ?? doc?.bodyJson ?? EMPTY_DOC,
        onSaved: (res) =>
            queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.chapter(doc?.id ?? 0), (old) =>
                old ? { ...old, version: res.version, wordCount: res.wordCount, bodyJson: res.body } : old,
            ),
    });

    // page 로 syncStatus / flushDraft 전달 (ref 로 안정화)
    const onSyncStatusRef = useRef(onSyncStatus);
    useEffect(() => {
        onSyncStatusRef.current = onSyncStatus;
    });
    useEffect(() => {
        onSyncStatusRef.current({ syncStatus: session.syncStatus, flushDraft: session.flushDraft });
    }, [session.syncStatus, session.flushDraft]);

    // session 은 매 렌더 새 객체(useDocumentSession 반환 함수가 useCallback 아님) — ref 로 안정화.
    // 핸들러 useCallback 이 session 을 deps 로 잡으면 매 렌더 새 함수가 되어
    // onConflict effect 가 무한 실행 → page setState 무한 루프(OOM). ref 로 끊는다.
    const sessionRef = useRef(session);
    useEffect(() => {
        sessionRef.current = session;
    });

    // 충돌 해결 핸들러 — page 의 충돌 다이얼로그 버튼에서 호출. session 은 ref 로 참조해 안정.
    const handleReload = useCallback(() => {
        const s = sessionRef.current;
        const conflict = s.conflict;
        if (!conflict) return;
        queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.chapter(doc?.id ?? 0), (old) =>
            old ? { ...old, bodyJson: conflict.currentBody, version: conflict.currentVersion } : old,
        );
        setBody(conflict.currentBody);
        setEditorKey((k) => k + 1);
        s.reloadFromServer(conflict.currentVersion, conflict.currentBody);
    }, [queryClient, doc?.id]);

    const handleOverwrite = useCallback(() => {
        const s = sessionRef.current;
        const conflict = s.conflict;
        if (!conflict) return;
        s.overwrite(conflict.currentVersion);
    }, []);

    // 충돌 상태 / 해결 핸들러를 page 로 전달 (ref 로 안정화)
    const onConflictRef = useRef(onConflict);
    useEffect(() => {
        onConflictRef.current = onConflict;
    });
    useEffect(() => {
        onConflictRef.current({
            conflict: session.conflict,
            reload: handleReload,
            overwrite: handleOverwrite,
        });
    }, [session.conflict, handleReload, handleOverwrite]);

    // localStorage-first 자동복원
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (session.restoredBody != null) setBody((b) => b ?? session.restoredBody);
    }, [session.restoredBody]);

    const handleChange = useCallback((change: DocumentChange) => setBody(change.bodyJson), []);

    const initialBody = body ?? session.restoredBody ?? doc?.bodyJson ?? null;

    const statusLabel =
        session.syncStatus === "syncing"
            ? "저장 중…"
            : session.syncStatus === "error"
              ? "저장 실패 — 잠시 후 다시 시도합니다"
              : session.syncStatus === "conflict"
                ? "충돌 — 다른 기기에서 수정됨"
                : "저장됨";
    const statusTone = session.syncStatus === "error" || session.syncStatus === "conflict" ? "error" : "ok";

    if (isLoading || !doc) {
        return (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white">
                <p className="text-sm text-gray-400">문서 불러오는 중…</p>
            </div>
        );
    }
    if (isError) {
        return (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white">
                <p className="text-sm text-gray-500">문서를 불러올 수 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-1 flex-col pt-11 min-[880px]:pt-0">
            <BEditor
                key={editorKey}
                initialBodyJson={initialBody ?? doc.bodyJson}
                onChange={handleChange}
                onDraftUpdate={session.flushDraft}
                onEditorReady={onEditorReady}
                statusLabel={statusLabel}
                statusTone={statusTone}
                paperSize={paperSize}
            />
        </div>
    );
}

export type { SyncStatus };
