"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import { documentKeys, useProjectDocument } from "@/lib/query/useDocument";
import { useProject } from "@/lib/query/useProjects";
import { logKeys } from "@/lib/query/useLogs";
import { useDocumentSession } from "@/hooks/useDocumentSession";
import { useWorkSession } from "@/hooks/useWorkSession";
import { rememberLastProject } from "@/lib/lastProject";
import { useEditorOutline } from "@/components/editor/useEditorOutline";
import { PaperEditor, type DocumentChange } from "@/components/editor/PaperEditor";
import { extractPlainText } from "@/components/editor/wordCountUtils";
import { BWorkSidePanel } from "@/components/b/BWorkSidePanel";
import type { ProjectDocument } from "@/lib/types/domain";

/**
 * B타입 집필 화면 — fable-test WorkDetailPage 3패널 골격: [목차 w-64 | 원고 | 메모·인물 w-80].
 * 원고 영역은 기존(A) PaperEditor 그대로 — 줄노트·페이지 분할·말풍선 서식 메뉴 동일(사용자 요구).
 * 자동저장 결선(useDocumentSession — localStorage draft·버전 토큰·충돌)과 작업 세션(useWorkSession)도
 * A 집필실과 동일 규약. 화면 전체 높이를 기능 패널로 채운다(공백 최소화).
 */
const EMPTY_DOC = JSON.stringify({ type: "doc", content: [] });

export default function BWorkDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const projectId = Number(params.id);
    const queryClient = useQueryClient();

    const projectQuery = useProject(projectId);
    const { data: doc, isLoading, isError } = useProjectDocument(projectId);

    const [body, setBody] = useState<string | null>(null);
    // editorKey: 복구/충돌 시 PaperEditor 강제 리마운트용(본문 교체 반영).
    const [editorKey, setEditorKey] = useState(0);
    const [lined, setLined] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [editor, setEditor] = useState<Editor | null>(null);
    // 타이핑으로 갱신된 글자수(공백 제외). 입력 전엔 서버 본문에서 파생한 초기값 표시.
    const [typedCount, setTypedCount] = useState<number | null>(null);
    const [endWorkOpen, setEndWorkOpen] = useState(false);
    const [endWorkBody, setEndWorkBody] = useState("");
    const [isEndingWork, setIsEndingWork] = useState(false);

    const { endWithLog } = useWorkSession(projectId);

    // 집필 네비("집필" 메뉴)가 돌아올 작품으로 기억 — A Rail 과 동일한 lastProject 공유.
    useEffect(() => {
        if (Number.isFinite(projectId)) rememberLastProject(projectId);
    }, [projectId]);

    const session = useDocumentSession({
        documentId: doc?.id ?? 0,
        projectId,
        serverBody: doc?.bodyJson ?? EMPTY_DOC,
        serverVersion: doc?.version ?? "",
        body: body ?? doc?.bodyJson ?? EMPTY_DOC,
        onSaved: (res) =>
            queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.byProject(projectId), (old) =>
                old ? { ...old, version: res.version, wordCount: res.wordCount, bodyJson: res.body } : old,
            ),
    });

    // localStorage-first 자동 복원 — 미동기화 draft 가 있으면 에디터 초기 본문으로 즉시 복원.
    const initialBody = body ?? session.restoredBody ?? doc?.bodyJson ?? null;

    useEffect(() => {
        // 미동기화 draft 를 편집 state 로 1회 채택(localStorage-first 복원). 외부(세션)→state 동기화라 effect 가 맞다.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (session.restoredBody != null) setBody((b) => b ?? session.restoredBody);
    }, [session.restoredBody]);

    const handleChange = useCallback((change: DocumentChange) => {
        setBody(change.bodyJson);
        setTypedCount(change.wordCount);
    }, []);

    // 진입 직후(타이핑 전) 글자수 — 초기 본문에서 파생.
    const initialCount = useMemo(
        () => extractPlainText(initialBody ?? doc?.bodyJson ?? "").replace(/\s/g, "").length,
        [initialBody, doc?.bodyJson],
    );
    const charCount = typedCount ?? initialCount;

    // 진짜 충돌(409) — 다시 불러오기: 서버 최신본 채택 / 덮어쓰기: 내 본문 강제 저장.
    const handleReload = useCallback(() => {
        const conflict = session.conflict;
        if (!conflict) return;
        queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.byProject(projectId), (old) =>
            old ? { ...old, bodyJson: conflict.currentBody, version: conflict.currentVersion } : old,
        );
        setBody(conflict.currentBody);
        setEditorKey((k) => k + 1);
        session.dismissConflict();
    }, [session, queryClient, projectId]);

    const handleEndWork = async () => {
        const trimmed = endWorkBody.trim();
        if (!trimmed || isEndingWork) return;
        setIsEndingWork(true);
        try {
            await endWithLog(trimmed);
            await queryClient.invalidateQueries({ queryKey: logKeys.all });
            setEndWorkOpen(false);
            setEndWorkBody("");
            router.push("/b");
        } catch {
            // 종료 실패 — 모달 유지(재시도 가능). closedRef 는 useWorkSession 이 복원.
        } finally {
            setIsEndingWork(false);
        }
    };

    const outline = useEditorOutline(editor);
    const projectTitle = projectQuery.data?.title ?? "";

    const statusLabel =
        session.syncStatus === "syncing"
            ? "저장 중…"
            : session.syncStatus === "error"
              ? "저장 실패 — 잠시 후 다시 시도합니다"
              : session.syncStatus === "conflict"
                ? "충돌 — 다른 기기에서 수정됨"
                : "저장됨";
    const isStatusError = session.syncStatus === "error" || session.syncStatus === "conflict";

    return (
        <div className="flex h-[calc(100vh-6.5rem)] gap-4">
            <div className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-200 p-3">
                    <Link href="/b" className="text-xs text-gray-400 hover:text-indigo-600">
                        ← 작품 목록
                    </Link>
                    <h1 className="mt-1 truncate text-base font-bold text-gray-900" title={projectTitle}>
                        {projectTitle || "집필"}
                    </h1>
                    {projectQuery.data?.nextScene && (
                        <p className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
                            다음 장면 — {projectQuery.data.nextScene}
                        </p>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    <p className="px-2 py-1 text-xs font-medium text-gray-400">목차</p>
                    {outline.items.length === 0 ? (
                        <p className="px-2 py-1 text-xs text-gray-400">
                            본문에 제목(H1·H2)을 넣으면 목차가 생깁니다.
                        </p>
                    ) : (
                        outline.items.map((item, i) => (
                            <button
                                key={`${item.index}-${item.text}`}
                                type="button"
                                onClick={() => outline.selectItem(item)}
                                className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${
                                    outline.activeIndex === i
                                        ? "bg-indigo-50 font-medium text-indigo-700"
                                        : "text-gray-600 hover:bg-gray-50"
                                } ${item.level === 2 ? "pl-5" : ""}`}
                            >
                                {item.text || "(제목 없음)"}
                            </button>
                        ))
                    )}
                </div>
                <div className="border-t border-gray-200 p-3">
                    <button
                        type="button"
                        onClick={() => {
                            setEndWorkBody("");
                            setEndWorkOpen(true);
                        }}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        작업 종료
                    </button>
                </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-end gap-3 border-b border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500">
                    <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={lined} onChange={(e) => setLined(e.target.checked)} />
                        줄노트
                    </label>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            aria-label="축소"
                            onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                            className="rounded-md px-2 py-0.5 text-sm text-gray-600 hover:bg-gray-100"
                        >
                            −
                        </button>
                        <span className="min-w-9 text-center">{Math.round(zoom * 100)}%</span>
                        <button
                            type="button"
                            aria-label="확대"
                            onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                            className="rounded-md px-2 py-0.5 text-sm text-gray-600 hover:bg-gray-100"
                        >
                            +
                        </button>
                    </div>
                </div>
                {/* .studio — desktop-app.css 가 .editor-scroll 에 flex:1 을 줘 원고가 카드 높이를 채운다. */}
                <div
                    className="studio min-h-0 flex-1"
                    style={{ ["--zoom"]: zoom, backgroundColor: "var(--w-canvas)" } as CSSProperties}
                >
                    {Number.isNaN(projectId) ? (
                        <p className="w-full self-center text-center text-sm text-gray-500">잘못된 작품입니다.</p>
                    ) : isLoading ? (
                        <p className="w-full self-center text-center text-sm text-gray-400">문서 불러오는 중…</p>
                    ) : isError || !doc ? (
                        <div className="flex w-full flex-col items-center gap-3 self-center">
                            <p className="text-sm text-gray-500">문서를 불러올 수 없습니다.</p>
                            <Link
                                href="/b"
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                작품 목록으로
                            </Link>
                        </div>
                    ) : (
                        <PaperEditor
                            key={editorKey}
                            title={projectTitle}
                            initialBodyJson={initialBody ?? doc.bodyJson}
                            onChange={handleChange}
                            onDraftUpdate={session.flushDraft}
                            onEditorReady={setEditor}
                            lined={lined}
                            zoom={zoom}
                        />
                    )}
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-1.5 text-xs text-gray-500">
                    <span role="status" aria-live="polite" className={isStatusError ? "text-red-600" : undefined}>
                        {statusLabel}
                    </span>
                    <span>{charCount.toLocaleString()}자 (공백 제외)</span>
                </div>
            </div>

            <BWorkSidePanel projectId={projectId} />

            {session.conflict != null && (
                <div className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4">
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
                    >
                        <h2 className="text-lg font-bold text-gray-900">저장 충돌</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            다른 기기(또는 탭)에서 이 문서를 수정했습니다. 어느 쪽을 남길까요?
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleReload}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                서버 최신본 불러오기
                            </button>
                            <button
                                type="button"
                                onClick={() => session.overwrite(session.conflict?.currentVersion ?? "")}
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                            >
                                내 본문으로 덮어쓰기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {endWorkOpen && (
                <div
                    className="fixed inset-0 z-30 flex items-center justify-center bg-gray-900/40 p-4"
                    onClick={() => !isEndingWork && setEndWorkOpen(false)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="작업 종료"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
                    >
                        <h2 className="text-lg font-bold text-gray-900">작업 종료</h2>
                        <p className="mt-1 text-sm text-gray-500">오늘의 기록을 남겨보세요</p>
                        <textarea
                            autoFocus
                            value={endWorkBody}
                            onChange={(e) => setEndWorkBody(e.target.value)}
                            placeholder="오늘의 기록을 남겨보세요…"
                            rows={4}
                            className="mt-3 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setEndWorkOpen(false)}
                                disabled={isEndingWork}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={handleEndWork}
                                disabled={endWorkBody.trim().length === 0 || isEndingWork}
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
