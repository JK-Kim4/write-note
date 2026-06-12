"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import type { DocumentChange } from "@/components/editor/PaperEditor";
import { BEditor } from "@/components/b/BEditor";
import { usePreferences } from "@/stores/preferences";
import { BWorkSidePanel } from "@/components/b/BWorkSidePanel";
import type { ProjectDocument } from "@/lib/types/domain";

/**
 * B타입 집필 화면 — fable-test WorkDetailPage 3패널: [목차 w-64 | 에디터 | 메모·인물 w-80].
 * 에디터는 BEditor(흰 배경 + 상단 서식 메뉴바 + 줄노트 라인 + 상태바) — 사용자 확정 디자인.
 * 자동저장 결선(useDocumentSession — localStorage draft·버전 토큰·충돌)과 작업 세션(useWorkSession)은
 * A 집필실과 동일 규약.
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
    // 좁은 폭 drawer 열림 상태 — 기본 닫힘. 880px 이상에서는 상태값 무관(항상 inline 3패널).
    const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
    const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
    const leftDrawerRef = useRef<HTMLDivElement>(null);
    const rightDrawerRef = useRef<HTMLDivElement>(null);

    const { endWithLog } = useWorkSession(projectId);
    const paperSize = usePreferences((s) => s.paperSize);

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

    const handleChange = useCallback((change: DocumentChange) => setBody(change.bodyJson), []);

    // 진짜 충돌(409) — 다시 불러오기: 서버 최신본·토큰을 세션 baseline 으로 채택 / 덮어쓰기: 내 본문 강제 저장.
    const handleReload = useCallback(() => {
        const conflict = session.conflict;
        if (!conflict) return;
        queryClient.setQueryData<ProjectDocument | undefined>(documentKeys.byProject(projectId), (old) =>
            old ? { ...old, bodyJson: conflict.currentBody, version: conflict.currentVersion } : old,
        );
        setBody(conflict.currentBody);
        setEditorKey((k) => k + 1);
        // dismissConflict 만 하면 세션 토큰이 옛 값에 머물러 다음 저장이 또 409(불러오기→충돌 루프).
        session.reloadFromServer(conflict.currentVersion, conflict.currentBody);
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

    // ESC 키로 열린 drawer 닫기.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (leftDrawerOpen) setLeftDrawerOpen(false);
            if (rightDrawerOpen) setRightDrawerOpen(false);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [leftDrawerOpen, rightDrawerOpen]);

    const outline = useEditorOutline(editor, ".b-editor-scroll");
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

    /** 목차 패널 내용 — 좁은 폭 drawer 와 넓은 폭 inline 모두 동일 마크업 공유. */
    const outlinePanel = (
        <>
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
                            onClick={() => {
                                outline.selectItem(item);
                                setLeftDrawerOpen(false);
                            }}
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
                        setLeftDrawerOpen(false);
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                    작업 종료
                </button>
            </div>
        </>
    );

    return (
        <div className="relative flex h-[calc(100vh-6.5rem)] gap-4">
            {/* ── 넓은 폭(≥880px): inline 목차 패널 ── */}
            <div className="hidden min-[880px]:flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
                {outlinePanel}
            </div>

            {/* ── 좁은 폭(<880px): 토글 버튼 row (에디터 위) + 백드롭 + drawer ── */}
            {/* 토글 버튼 row — 좁은 폭에서만 표시, floating bar */}
            <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center gap-2 px-2 pt-1.5 min-[880px]:hidden">
                <button
                    type="button"
                    aria-label="목차 패널 열기"
                    onClick={() => setLeftDrawerOpen(true)}
                    className="pointer-events-auto rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm hover:bg-gray-50"
                >
                    목차
                </button>
                <button
                    type="button"
                    aria-label="쪽지·인물 패널 열기"
                    onClick={() => setRightDrawerOpen(true)}
                    className="pointer-events-auto rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 shadow-sm hover:bg-gray-50"
                >
                    쪽지·인물
                </button>
            </div>

            {/* 좁은 폭 좌측 drawer 백드롭 */}
            {leftDrawerOpen && (
                <div
                    aria-hidden="true"
                    className="fixed inset-0 z-20 bg-gray-900/40 min-[880px]:hidden"
                    onClick={() => setLeftDrawerOpen(false)}
                />
            )}
            {/* 좁은 폭 좌측 drawer */}
            <div
                ref={leftDrawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="목차"
                className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col overflow-hidden bg-white shadow-xl transition-transform duration-200 min-[880px]:hidden ${
                    leftDrawerOpen ? "translate-x-0" : "-translate-x-full"
                }`}
            >
                <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                    <span className="text-sm font-medium text-gray-700">목차</span>
                    <button
                        type="button"
                        aria-label="목차 패널 닫기"
                        onClick={() => setLeftDrawerOpen(false)}
                        className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex flex-1 flex-col overflow-hidden">{outlinePanel}</div>
            </div>

            {/* 좁은 폭 우측 drawer 백드롭 */}
            {rightDrawerOpen && (
                <div
                    aria-hidden="true"
                    className="fixed inset-0 z-20 bg-gray-900/40 min-[880px]:hidden"
                    onClick={() => setRightDrawerOpen(false)}
                />
            )}
            {/* 좁은 폭 우측 drawer */}
            <div
                ref={rightDrawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="쪽지·인물"
                className={`fixed inset-y-0 right-0 z-30 flex w-80 flex-col overflow-hidden bg-gray-50 shadow-xl transition-transform duration-200 min-[880px]:hidden ${
                    rightDrawerOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2">
                    <span className="text-sm font-medium text-gray-700">쪽지·인물</span>
                    <button
                        type="button"
                        aria-label="쪽지·인물 패널 닫기"
                        onClick={() => setRightDrawerOpen(false)}
                        className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex flex-1 flex-col overflow-hidden">
                    <BWorkSidePanel projectId={projectId} />
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
                    paperSize={paperSize}
                />
            )}

            {/* ── 넓은 폭(≥880px): inline 우측 패널 ── */}
            {/* display:contents 로 래퍼가 flex-item 취급 없이 BWorkSidePanel 의 자체 w-80/w-8 이 부모 flex 에 직접 참여. */}
            <div className="hidden min-[880px]:contents">
                <BWorkSidePanel projectId={projectId} />
            </div>

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
