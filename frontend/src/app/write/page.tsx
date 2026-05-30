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
    return (
        <div className="px-6 py-10 max-w-4xl mx-auto">
            <div
                className="rounded-card-mode p-8"
                style={{
                    backgroundColor: "var(--w-manuscript-cream)",
                    border: "1px solid var(--w-hairline)",
                    fontFamily: "var(--w-font-manuscript)",
                    color: "var(--w-ink)",
                    lineHeight: 2,
                    fontSize: "18px",
                    minHeight: "70vh",
                }}
            >
                <div className="text-xs mb-6" style={{ opacity: 0.5 }}>
                    400 자 격자 · 20×20 · 컬럼 마커 5/10/15/20 · 행 번호 (placeholder — US2)
                </div>
                <p style={{ opacity: 0.6 }}>
                    원고지 격자 본문은 US2 에서 합류합니다.
                </p>
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
