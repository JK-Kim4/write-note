"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import { documentKeys, useProjectDocument } from "@/lib/query/useDocument";
import { useProject } from "@/lib/query/useProjects";
import { logKeys } from "@/lib/query/useLogs";
import { useDocumentSession } from "@/hooks/useDocumentSession";
import { useWorkSession } from "@/hooks/useWorkSession";
import { useEditorOutline } from "@/components/editor/useEditorOutline";
import { BEditor } from "@/components/b/BEditor";
import { BWorkSidePanel } from "@/components/b/BWorkSidePanel";
import type { ProjectDocument } from "@/lib/types/domain";

/**
 * B타입 집필 화면 — fable-test WorkDetailPage 3패널 이식: [목차 w-64 | 에디터 | 메모·인물 w-80].
 * 자동저장 결선(useDocumentSession — localStorage draft·버전 토큰·충돌)과 작업 세션(useWorkSession)은
 * A 디자인 집필실과 동일 규약. 화면 전체 높이를 기능 패널로 채운다(공백 최소화).
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
    // editorKey: 복구/충돌 시 BEditor 강제 리마운트용(본문 교체 반영).
    const [editorKey, setEditorKey] = useState(0);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [endWorkOpen, setEndWorkOpen] = useState(false);
    const [endWorkBody, setEndWorkBody] = useState("");
    const [isEndingWork, setIsEndingWork] = useState(false);

    const { endWithLog } = useWorkSession(projectId);

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

    const handleChange = useCallback((change: { bodyJson: string }) => setBody(change.bodyJson), []);

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
    const statusTone = session.syncStatus === "error" || session.syncStatus === "conflict" ? "error" : "ok";

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

            {Number.isNaN(projectId) ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white">
                    <p className="text-sm text-gray-500">잘못된 작품입니다.</p>
                </div>
            ) : isLoading ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white">
                    <p className="text-sm text-gray-400">문서 불러오는 중…</p>
                </div>
            ) : isError || !doc ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white">
                    <p className="text-sm text-gray-500">문서를 불러올 수 없습니다.</p>
                    <Link
                        href="/b"
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        작품 목록으로
                    </Link>
                </div>
            ) : (
                <BEditor
                    key={editorKey}
                    initialBodyJson={initialBody ?? doc.bodyJson}
                    onChange={handleChange}
                    onDraftUpdate={session.flushDraft}
                    onEditorReady={setEditor}
                    statusLabel={statusLabel}
                    statusTone={statusTone}
                />
            )}

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
