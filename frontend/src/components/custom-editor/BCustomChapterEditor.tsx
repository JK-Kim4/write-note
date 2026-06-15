"use client";

/**
 * B형 단일 챕터 편집 세션 컴포넌트 — 자체 엔진(CustomEditor) 버전.
 *
 * BChapterEditor 와 동일한 useDocumentSession 결선·충돌·flushDraft·localStorage-first 복원 구조.
 * TipTap 대신 CustomEditor(DocModel 기반)를 사용한다.
 *
 * 무한루프 회피 (022 BChapterEditor 회귀 사례):
 * - session 은 매 렌더 새 객체 → ref 로 안정화(sessionRef).
 * - handleReload/handleOverwrite 의 useCallback deps 에 session 직접 참조 금지.
 * - onConflict/onSyncStatus effect 는 session.conflict/session.syncStatus 만 deps 로.
 *
 * stale 토큰 회귀 회피 (022 챕터 거짓 409 사례):
 * - key={documentId} 리마운트는 셸(BStudioShell) 또는 라우트에서 보장.
 * - 본 컴포넌트 내부에서도 editorKey state 로 reload/overwrite 시 CustomEditor 강제 리마운트.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PaperSize as LayoutPaperSize } from "@/components/editor/pageLayout";
import type { BChapterEditorConflictHandlers, BChapterEditorSyncStatus } from "@/components/b/BChapterEditor";
import { documentKeys, useChapterDocument } from "@/lib/query/useDocument";
import type { ProjectDocument } from "@/lib/types/domain";
import { useDocumentSession } from "@/hooks/useDocumentSession";
import { CustomEditor } from "./CustomEditor";
import { pmJsonToModel, modelToPmJson } from "./pmConvert";
import type { DocModel } from "./model";
import type { PaperSize as GeoPaperSize } from "./geometry";

/** pageLayout PaperSize → geometry PaperSize 매핑. A4/A3/A2/B4 는 동일 문자열, 타입만 다름. */
function toGeoPaperSize(size: LayoutPaperSize): GeoPaperSize {
    // geometry.ts 지원: "A5" | "A4" | "B4" | "A3" | "A2". pageLayout 의 A4/A3/A2/B4 는 전부 포함.
    return size as GeoPaperSize;
}

/** 본문 fontSizePx 고정 상수 — 사용자 노출 없음. */
const FONT_SIZE_PX = 18;

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [] });

interface BCustomChapterEditorProps {
    /** BStudioShell 의 BStudioEditorSlotArgs 와 동일 형태. */
    currentChapterId: number;
    projectId: number;
    paperSize: LayoutPaperSize;
    chapterTitle?: string;
    onChapterRename?: (title: string) => void;
    onSyncStatus: (status: BChapterEditorSyncStatus) => void;
    onConflict: (handlers: BChapterEditorConflictHandlers) => void;
}

export function BCustomChapterEditor({
    currentChapterId,
    projectId,
    paperSize,
    onSyncStatus,
    onConflict,
}: BCustomChapterEditorProps) {
    const documentId = currentChapterId;
    const queryClient = useQueryClient();
    const { data: doc, isLoading, isError } = useChapterDocument(documentId);

    // DocModel state — pmJsonToModel(doc.bodyJson) 로 초기화. body string 은 modelToPmJson 역변환.
    const [model, setModel] = useState<DocModel | null>(null);
    // 같은 챕터 내 reload/overwrite 시 CustomEditor 강제 리마운트용.
    const [editorKey, setEditorKey] = useState(0);

    // DocModel → PM JSON 문자열 (useDocumentSession body 인자용)
    const bodyForSession = model != null ? modelToPmJson(model) : doc?.bodyJson ?? EMPTY_DOC;

    // 유실 근본원인 #1 — 로드 시 거짓 dirty 방지: serverBody 를 모델 왕복과 동일하게 정규화한다.
    // pmJsonToModel→modelToPmJson 은 빈 문서를 `content:[{paragraph}]` 로 정규화하므로, 정규화 안 한
    // serverBody(`content:[]`)와 body(정규화형)가 달라 진입 즉시 dirty 로 오판 → 거짓 자동저장 → baseline 이탈.
    const normalizedServerBody = doc ? modelToPmJson(pmJsonToModel(doc.bodyJson)) : EMPTY_DOC;

    const session = useDocumentSession({
        documentId: doc?.id ?? 0,
        projectId,
        serverBody: normalizedServerBody,
        serverVersion: doc?.version ?? "",
        body: bodyForSession,
        onSaved: (res) =>
            queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.chapter(doc?.id ?? 0), (old) =>
                old ? { ...old, version: res.version, wordCount: res.wordCount, bodyJson: res.body } : old,
            ),
    });

    // session 은 매 렌더 새 객체 → ref 로 안정화(무한루프 회피).
    const sessionRef = useRef(session);
    useEffect(() => {
        sessionRef.current = session;
    });

    // 유실 근본원인 #2 — 셸(BStudioShell)은 챕터 전환 직전 flushDraft 를 *stale 빈 본문*으로 호출한다
    // (latestBodyForFlushRef 가 빈 문서로 초기화 후 미갱신). 그 빈 본문을 그대로 draft 에 쓰면 작성분이 덮인다.
    // → 에디터가 보고하는 flush 는 전달 인자를 무시하고 **항상 자기 최신 모델**을 flush 하도록 한다.
    const latestModelRef = useRef<DocModel | null>(model);
    const flushLatest = useCallback((_ignored?: string) => {
        const m = latestModelRef.current;
        if (m != null) sessionRef.current.flushDraft(modelToPmJson(m));
    }, []);

    // page 로 syncStatus / flushDraft 전달 (ref 로 안정화)
    const onSyncStatusRef = useRef(onSyncStatus);
    useEffect(() => {
        onSyncStatusRef.current = onSyncStatus;
    });
    useEffect(() => {
        onSyncStatusRef.current({ syncStatus: session.syncStatus, flushDraft: flushLatest });
    }, [session.syncStatus, flushLatest]);

    // 충돌 해결 핸들러 — session 은 ref 로 참조해 안정(무한루프 회피).
    const handleReload = useCallback(() => {
        const s = sessionRef.current;
        const conflict = s.conflict;
        if (!conflict) return;
        const newModel = pmJsonToModel(conflict.currentBody);
        queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.chapter(doc?.id ?? 0), (old) =>
            old ? { ...old, bodyJson: conflict.currentBody, version: conflict.currentVersion } : old,
        );
        setModel(newModel);
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

    // localStorage-first 자동복원 — restoredBody 가 있으면 PM JSON → DocModel 로 초기화.
    useEffect(() => {
        if (session.restoredBody != null && model == null) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setModel(pmJsonToModel(session.restoredBody));
        }
        // model 을 deps 에 넣으면 매 모델변경마다 실행 → session.restoredBody null 체크가 충분
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session.restoredBody]);

    // 서버 본문 로드 후 최초 1회 DocModel 초기화.
    useEffect(() => {
        if (doc && model == null) {
            const initialBody = session.restoredBody ?? doc.bodyJson;
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setModel(pmJsonToModel(initialBody));
        }
        // model 을 deps 에 넣으면 편집마다 재초기화 → 최초 1회만 의도
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc]);

    // 모델 변경 핸들러 — (a) model state 갱신 (b) PM JSON 으로 draft flush.
    const handleModelChange = useCallback(
        (next: DocModel) => {
            latestModelRef.current = next; // 전환 flush(flushLatest)가 항상 최신 모델을 보게.
            setModel(next);
            // IME 무유실: 타자 즉시 draft flush (BChapterEditor onDraftUpdate 패턴).
            sessionRef.current.flushDraft(modelToPmJson(next));
        },
        [],
    );

    if (isLoading || (!doc && !isError)) {
        return (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white">
                <p className="text-sm text-gray-400">문서 불러오는 중…</p>
            </div>
        );
    }
    if (isError || !doc) {
        return (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white">
                <p className="text-sm text-gray-500">문서를 불러올 수 없습니다.</p>
            </div>
        );
    }

    // model 이 아직 null 이면(doc 로드 직후 effect 미실행) 즉시 파생해 초기 렌더링 지연 방지.
    const currentModel = model ?? pmJsonToModel(session.restoredBody ?? doc.bodyJson);

    return (
        <div className="flex min-w-0 flex-1 flex-col pt-11 min-[880px]:pt-0">
            <CustomEditor
                key={editorKey}
                model={currentModel}
                onModelChange={handleModelChange}
                paperSize={toGeoPaperSize(paperSize)}
                fontSizePx={FONT_SIZE_PX}
            />
        </div>
    );
}
