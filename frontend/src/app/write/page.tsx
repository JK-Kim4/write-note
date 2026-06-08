"use client";

import { Suspense, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { usePreferences } from "@/stores/preferences";
import { getProjectDocument } from "@/lib/api/document";
import { Editor } from "@/components/editor/Editor";
import { WordCount } from "@/components/editor/WordCount";
import { ConflictDialog } from "@/components/editor/ConflictDialog";
import { useAutoSave } from "@/hooks/useAutoSave";
import { ManuscriptGrid } from "@/components/editor/ManuscriptGrid";
import { countCharsForManuscript, calcManuscriptPages } from "@/components/editor/manuscript";

/**
 * Write page — preferences.writingMode 에 따라 manuscript vs editor layout 분기.
 *
 * Spec reference: contracts/route-surfaces.md §2-2 + 006 US1 (T020)
 * - 에디터 모드: TipTap + 자동저장 + 충돌 다이얼로그 실데이터
 * - 원고지 모드(US2): placeholder 유지
 * - ?projectId= search param 으로 활성 프로젝트 문서 로드 (R-7)
 */

export default function WritePage() {
    return (
        <Suspense fallback={<div style={{ padding: "2rem", color: "var(--w-ink)", opacity: 0.5 }}>불러오는 중…</div>}>
            <WritePageInner />
        </Suspense>
    );
}

function WritePageInner() {
    const writingMode = usePreferences((s) => s.writingMode);
    return writingMode === "manuscript" ? <ManuscriptLayout /> : <EditorLayout />;
}

function ManuscriptLayout() {
    const projectIdParam = useSearchParams().get("projectId");
    const projectId = projectIdParam != null ? parseInt(projectIdParam, 10) : null;
    const manuscriptSize = usePreferences((s) => s.manuscriptSize);

    const { data: doc } = useQuery({
        queryKey: ["document", "byProject", projectId],
        queryFn: () => {
            if (projectId == null || isNaN(projectId)) {
                return Promise.reject(new Error("projectId 없음"));
            }
            return getProjectDocument(projectId);
        },
        enabled: projectId != null && !isNaN(projectId),
        retry: false,
    });

    const [body, setBody] = useState<string | null>(null);
    const docBody = doc?.body ?? null;
    const currentBody = body ?? docBody ?? JSON.stringify({ type: "doc", content: [] });

    const handleBodyChange = useCallback((newBody: string) => {
        setBody(newBody);
    }, []);

    const chars = countCharsForManuscript(currentBody);
    const pages = calcManuscriptPages(chars, manuscriptSize);
    const displayPages = Math.max(1, pages);

    return (
        <div className="px-6 py-10 max-w-5xl mx-auto w-full">
            {/* 상단 매수 / 자수 표시 */}
            <div
                className="flex items-center gap-4 mb-6"
                style={{ fontSize: "13px", color: "var(--w-ink)", opacity: 0.6 }}
            >
                <span>
                    {manuscriptSize}자 원고지
                </span>
                <span>·</span>
                <span>{chars.toLocaleString()}자</span>
                <span>·</span>
                <span>{displayPages}매</span>
            </div>

            {/* 격자 오버레이 + 본문 에디터 (같은 Document body 공유) */}
            <div style={{ position: "relative" }}>
                {/* 표시 전용 격자 레이어 */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 0,
                        pointerEvents: "none",
                    }}
                >
                    <ManuscriptGrid size={manuscriptSize} pages={displayPages} />
                </div>

                {/* 에디터 본문 — 격자 위에 위치, 고정폭 한글 폰트 */}
                <div
                    style={{
                        position: "relative",
                        zIndex: 1,
                        fontFamily: "var(--w-font-manuscript)",
                        fontSize: "1.6em",
                        lineHeight: "1.6em",
                        color: "var(--w-ink)",
                        // 완화 모드: 글자가 격자를 정확히 안 채워도 깨지지 않게
                        // 실제 칸 정렬 정밀 검증은 dogfooding(T028) 영역
                        letterSpacing: "0.1em",
                        wordBreak: "break-all",
                        padding: "24px 24px 24px 58px",
                        backgroundColor: "transparent",
                    }}
                >
                    <Editor
                        initialContent={currentBody}
                        onBodyChange={handleBodyChange}
                    />
                </div>
            </div>
        </div>
    );
}

function EditorLayout() {
    const projectIdParam = useSearchParams().get("projectId");
    const projectId = projectIdParam != null ? parseInt(projectIdParam, 10) : null;

    const { data: doc, isLoading, isError } = useQuery({
        queryKey: ["document", "byProject", projectId],
        queryFn: () => {
            if (projectId == null || isNaN(projectId)) {
                return Promise.reject(new Error("projectId 없음"));
            }
            return getProjectDocument(projectId);
        },
        enabled: projectId != null && !isNaN(projectId),
        retry: false,
    });

    const [body, setBody] = useState<string | null>(null);

    // 문서 로드 완료 시 body 초기화 (한 번만)
    const docBody = doc?.body ?? null;
    const initialBody = body ?? docBody;

    const handleBodyChange = useCallback((newBody: string) => {
        setBody(newBody);
    }, []);

    const autoSave = useAutoSave(
        {
            documentId: doc?.id ?? 0,
            body: initialBody ?? JSON.stringify({ type: "doc", content: [] }),
            version: doc?.version ?? 0,
        },
    );

    const handleReload = useCallback((currentBody: string) => {
        setBody(currentBody);
        autoSave.dismissConflict();
    }, [autoSave]);

    const handleOverwrite = useCallback((currentVersion: number) => {
        autoSave.overwrite(currentVersion);
    }, [autoSave]);

    if (projectId == null || isNaN(projectId)) {
        return (
            <div className="flex-1 px-8 py-10 max-w-3xl mx-auto w-full">
                <p style={{ color: "var(--w-ink)", opacity: 0.6, fontSize: "14px" }}>
                    프로젝트를 선택하면 문서를 열 수 있습니다. (?projectId=N)
                </p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex-1 px-8 py-10 max-w-3xl mx-auto w-full">
                <p style={{ color: "var(--w-ink)", opacity: 0.5 }}>문서 불러오는 중…</p>
            </div>
        );
    }

    if (isError || !doc) {
        return (
            <div className="flex-1 px-8 py-10 max-w-3xl mx-auto w-full">
                <p style={{ color: "var(--w-ink)", opacity: 0.6 }}>문서를 불러올 수 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* 툴바 영역 */}
            <div
                className="flex items-center gap-1 px-4 py-2"
                style={{
                    backgroundColor: "var(--w-canvas)",
                    borderBottom: "1px solid var(--w-hairline)",
                }}
            >
                {["B", "I", "U", "S", "❝", "•", "↶", "↷"].map((g) => (
                    <button
                        key={g}
                        type="button"
                        className="px-2 py-1 rounded-button-utility text-sm"
                        style={{ color: "var(--w-ink)", opacity: 0.7 }}
                    >
                        {g}
                    </button>
                ))}
                {/* 자수 카운터 */}
                <div className="ml-auto">
                    <WordCount
                        wordCount={autoSave.wordCount > 0 ? autoSave.wordCount : doc.wordCount}
                        targetLength={null /* 프로젝트 targetLength — layout 에서 주입 예정 */}
                    />
                </div>
                {/* 자동저장 상태 표시 */}
                <span style={{ fontSize: "12px", color: "var(--w-ink)", opacity: 0.5, minWidth: "60px" }}>
                    {autoSave.status === "saving" && "저장 중…"}
                    {autoSave.status === "saved" && "저장됨"}
                    {autoSave.status === "error" && "저장 실패"}
                    {autoSave.status === "conflict" && "충돌"}
                </span>
            </div>

            {/* 에디터 본문 */}
            <div className="flex-1 px-8 py-10 max-w-3xl mx-auto w-full overflow-y-auto">
                <Editor
                    initialContent={doc.body}
                    onBodyChange={handleBodyChange}
                />
            </div>

            {/* 충돌 다이얼로그 */}
            {autoSave.status === "conflict" && autoSave.conflict != null && (
                <ConflictDialog
                    conflict={autoSave.conflict}
                    onReload={handleReload}
                    onOverwrite={handleOverwrite}
                />
            )}
        </div>
    );
}
