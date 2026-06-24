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

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PaperSize as LayoutPaperSize } from "@/components/editor/pageLayout";
import type { BChapterEditorConflictHandlers, BChapterEditorSyncStatus } from "./types";
import { documentKeys, useChapterDocument } from "@/lib/query/useDocument";
import { StudioSkeleton } from "@/components/b/StudioSkeleton";
import type { ProjectDocument } from "@/lib/types/domain";
import { useDocumentSession } from "@/hooks/useDocumentSession";
import { CustomEditor, type CustomEditorRef } from "./CustomEditor";
import { pmJsonToModel, modelToPmJson } from "./pmConvert";
import { outlineFromModel, type OutlineItem } from "./outline";
import type { DocModel } from "./model";
import { fontPxFor, type PaperSize as GeoPaperSize } from "./geometry";
import { countChars } from "./charCount";
import type { FontScale, LayoutMode } from "@/types/api";

/** pageLayout PaperSize → geometry PaperSize 매핑. ISO·판형 동일 문자열, 타입만 다름(판형은 양쪽 동일 식별자). */
function toGeoPaperSize(size: LayoutPaperSize): GeoPaperSize {
    // geometry.ts 는 pageLayout 의 8종(A4/A3/A2/B4 + 판형 4종)을 모두 포함(+ A5).
    return size as GeoPaperSize;
}

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [] });

interface BCustomChapterEditorProps {
    /** BStudioShell 의 BStudioEditorSlotArgs 와 동일 형태. */
    currentChapterId: number;
    projectId: number;
    paperSize: LayoutPaperSize;
    fontScale: FontScale;
    layoutMode: LayoutMode;
    /** 실시간 글자수 보고(031 분량 지표). 안정 참조여야 함(셸 setState). */
    onWordCountChange?: (count: number) => void;
    onSyncStatus: (status: BChapterEditorSyncStatus) => void;
    onConflict: (handlers: BChapterEditorConflictHandlers) => void;
    /** 전체 문서 모델에서 파생한 목차(여러 페이지에 걸친 heading 전부)를 page 로 올린다. */
    onOutlineChange?: (items: OutlineItem[]) => void;
}

export const BCustomChapterEditor = forwardRef<CustomEditorRef, BCustomChapterEditorProps>(function BCustomChapterEditor(
    { currentChapterId, projectId, paperSize, fontScale, layoutMode, onWordCountChange, onSyncStatus, onConflict, onOutlineChange },
    editorRef,
) {
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
        onSaved: (res) => {
            queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.chapter(doc?.id ?? 0), (old) =>
                old ? { ...old, version: res.version, wordCount: res.wordCount, bodyJson: res.body } : old,
            );
            // 저장이 서버에 안착하면 라이브러리 작품 카드·시리즈 진척(totalWordCount) 캐시를 무효화한다.
            // 작품 목록/작업 종료는 flushNow-후-네비라 라이브러리 refetchOnMount 로 이미 최신이지만, await 불가한
            // 뒤로가기는 라이브러리 refetch 가 flush 안착보다 먼저 끝날 수 있어 — 안착 후 무효화로 글자수를 따라잡는다.
            // (["projects"]/["categories"] 인라인 = useProjects 의 순환 import 회피 패턴과 동일.)
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            queryClient.invalidateQueries({ queryKey: ["categories"] });
        },
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

    // 이탈 동기 저장 — 최신 모델을 세션에 밀어넣은 뒤(flushDraft 가 latestBodyRef 갱신) 정상 저장 경로로
    // 끝까지 await. 셸(작품 목록/작업 종료)이 네비 전에, 본 컴포넌트가 언마운트(뒤로가기) 시에 호출한다.
    const flushNow = useCallback(async () => {
        const m = latestModelRef.current;
        if (m != null) sessionRef.current.flushDraft(modelToPmJson(m));
        await sessionRef.current.flushNow();
    }, []);

    // page 로 syncStatus / flush 통로 전달 (ref 로 안정화)
    const onSyncStatusRef = useRef(onSyncStatus);
    useEffect(() => {
        onSyncStatusRef.current = onSyncStatus;
    });
    useEffect(() => {
        onSyncStatusRef.current({ syncStatus: session.syncStatus, flushDraft: flushLatest, flushNow });
    }, [session.syncStatus, flushLatest, flushNow]);

    // 언마운트 best-effort flush — await 가 불가능한 이탈(브라우저 뒤로가기/탭 전환 SPA 네비)에서
    // 미동기화분을 서버에 반영한다. 실패해도 draft 가 보존돼 재진입 시 복원되므로 작성분은 유실되지 않는다.
    // (작품 목록/작업 종료 등 await 가능한 경로는 셸이 네비 전에 flushNow 를 이미 완료 → 여기선 not-dirty no-op.)
    useEffect(
        () => () => {
            void flushNow();
        },
        [flushNow],
    );

    // 전체 문서 목차를 page 로 올린다(모델 파생). model 변경(키 입력 포함)마다 파생하되, 목차 시그니처가
    // 실제로 바뀔 때만 onOutlineChange 호출 → 키 입력마다 부모 setState/리렌더 + 무한루프 회피.
    // onOutlineChange 는 ref 로 안정화(매 렌더 새 인스턴스여도 effect 재실행 방지).
    const onOutlineChangeRef = useRef(onOutlineChange);
    useEffect(() => {
        onOutlineChangeRef.current = onOutlineChange;
    });
    const outlineSigRef = useRef<string>("");
    useEffect(() => {
        if (model == null) return;
        const items = outlineFromModel(model);
        const sig = JSON.stringify(items);
        if (sig === outlineSigRef.current) return;
        outlineSigRef.current = sig;
        onOutlineChangeRef.current?.(items);
    }, [model]);

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

    // 글자수 보고(031 분량 지표) — model 변경 시 셸로 올림. 타이핑마다 셸 리렌더되지 않게 디바운스(400ms)
    // 해 입력 지연을 막는다. onWordCountChange 는 안정 참조(셸 setState).
    useEffect(() => {
        const id = setTimeout(() => onWordCountChange?.(countChars(model?.buffer ?? "")), 400);
        return () => clearTimeout(id);
    }, [model, onWordCountChange]);

    if (isLoading || (!doc && !isError)) {
        // 본문 로딩도 라우트·셸과 동일 스켈레톤 — 단계 간 깜빡임 없이 이어진다.
        return <StudioSkeleton />;
    }
    if (isError || !doc) {
        return (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-surface">
                <p className="text-sm text-muted">문서를 불러올 수 없습니다.</p>
            </div>
        );
    }

    // model 이 아직 null 이면(doc 로드 직후 effect 미실행) 즉시 파생해 초기 렌더링 지연 방지.
    const currentModel = model ?? pmJsonToModel(session.restoredBody ?? doc.bodyJson);

    return (
        <div className="flex min-w-0 flex-1 flex-col pt-11 min-[880px]:pt-0">
            <CustomEditor
                key={editorKey}
                ref={editorRef}
                model={currentModel}
                onModelChange={handleModelChange}
                paperSize={toGeoPaperSize(paperSize)}
                fontSizePx={fontPxFor(toGeoPaperSize(paperSize), fontScale)}
                layoutMode={layoutMode}
            />
        </div>
    );
});

BCustomChapterEditor.displayName = "BCustomChapterEditor";
