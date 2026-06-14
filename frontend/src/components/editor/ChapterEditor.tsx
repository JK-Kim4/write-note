"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import { documentKeys, useChapterDocument } from "@/lib/query/useDocument";
import type { ProjectDocument } from "@/lib/types/domain";
import { useDocumentSession, type SyncStatus } from "@/hooks/useDocumentSession";
import { PaperEditor } from "@/components/editor/PaperEditor";
import { ConflictDialog } from "@/components/editor/ConflictDialog";

/**
 * 단일 챕터 편집 세션 컴포넌트 (022 방안 A).
 *
 * **핵심**: `page.tsx` 에서 `<ChapterEditor key={currentChapterId} />` 로 사용하면
 * 챕터 전환(currentChapterId 변경) 시 이 컴포넌트가 언마운트 → 리마운트된다.
 * → `useDocumentSession` 도 새 인스턴스로 초기화 → versionRef 가 새 챕터 토큰으로 세팅.
 * → 거짓 409 충돌 해결.
 *
 * 016 자동저장 보증:
 * - IME 조합 중 무유실: 챕터 전환 직전 page 에서 `flushDraftRef.current(latestBody)` 를 호출해
 *   현재 챕터 본문을 localStorage draft 에 flush 한 뒤 전환한다.
 *   ChapterEditor 언마운트 시 `pagehide` 등 cleanup 도 자동으로 동작한다.
 * - localStorage-first 자동복원·draft 키 격리·거짓409 방지(같은 챕터 내)는 useDocumentSession 에서 보장.
 */

export interface ChapterEditorSyncStatus {
    syncStatus: SyncStatus;
    /** flushDraft — page 에서 챕터 전환 직전 현재 본문을 즉시 draft 에 기록(IME 유실 방지). */
    flushDraft: (body: string) => void;
}

interface ChapterEditorProps {
    documentId: number;
    projectId: number;
    projectTitle: string;
    lined: boolean;
    zoom: number;
    /** 에디터 인스턴스를 page 로 올려 아웃라인 갱신에 사용. */
    onEditorReady: (editor: Editor | null) => void;
    /** 저장 상태를 page titlebar 로 전달. */
    onSyncStatus: (status: ChapterEditorSyncStatus) => void;
}

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [] });

export function ChapterEditor({ documentId, projectId, projectTitle, lined, zoom, onEditorReady, onSyncStatus }: ChapterEditorProps) {
    const queryClient = useQueryClient();
    const { data: doc, isLoading, isError } = useChapterDocument(documentId);

    const [body, setBody] = useState<string | null>(null);
    // 같은 챕터 내 reload / overwrite 시 PaperEditor 를 강제 리마운트.
    // 챕터 전환은 외부 key={documentId} 가 담당하므로 내부 editorKey 는 reload/overwrite 전용.
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

    // page 로 syncStatus / flushDraft 를 전달 — titlebar 저장 상태 표시용.
    // onSyncStatus 는 매 render 마다 새 객체를 전달하지 않도록 ref 로 안정화.
    const onSyncStatusRef = useRef(onSyncStatus);
    useEffect(() => {
        onSyncStatusRef.current = onSyncStatus;
    });
    useEffect(() => {
        onSyncStatusRef.current({ syncStatus: session.syncStatus, flushDraft: session.flushDraft });
    }, [session.syncStatus, session.flushDraft]);

    // localStorage-first 자동복원
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (session.restoredBody != null) setBody((b) => b ?? session.restoredBody);
    }, [session.restoredBody]);

    const handleChange = useCallback((change: { bodyJson: string }) => setBody(change.bodyJson), []);

    const handleReload = useCallback(
        (currentBody: string) => {
            const currentVersion = session.conflict?.currentVersion ?? doc?.version ?? "";
            queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.chapter(doc?.id ?? 0), (old) =>
                old ? { ...old, bodyJson: currentBody, version: currentVersion } : old,
            );
            setBody(currentBody);
            setEditorKey((k) => k + 1);
            session.reloadFromServer(currentVersion, currentBody);
        },
        [session, queryClient, doc?.id, doc?.version],
    );

    const handleOverwrite = useCallback(
        (currentVersion: string) => session.overwrite(currentVersion),
        [session],
    );

    const initialBody = body ?? session.restoredBody ?? doc?.bodyJson ?? null;

    if (isLoading || !doc) {
        return <p style={{ padding: "2rem", opacity: 0.5 }}>문서 불러오는 중…</p>;
    }
    if (isError) {
        return <p style={{ padding: "2rem", opacity: 0.6 }}>문서를 불러올 수 없습니다.</p>;
    }

    return (
        <>
            <PaperEditor
                key={editorKey}
                title={projectTitle}
                initialBodyJson={initialBody ?? doc.bodyJson}
                onChange={handleChange}
                onDraftUpdate={session.flushDraft}
                onEditorReady={onEditorReady}
                lined={lined}
                zoom={zoom}
            />
            {session.conflict != null && (
                <ConflictDialog conflict={session.conflict} onReload={handleReload} onOverwrite={handleOverwrite} />
            )}
        </>
    );
}
