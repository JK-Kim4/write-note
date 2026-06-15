"use client";

/**
 * B형 집필실 — 자체 에디터 엔진(실험) 라우트 (024 US1 T012).
 *
 * BStudioShell 에 BCustomChapterEditor(자체엔진)를 주입하는 얇은 래퍼.
 * - 아웃라인은 useCustomOutline(DOM 파생): items / activeIndex / selectItem.
 *   US2(T025) 구현 — STUB_OUTLINE 교체 완료.
 * - 챕터 관리·세션·충돌 다이얼로그는 BStudioShell 이 처리.
 * - chapterUrlBase: `/b/works/[id]/custom` 라우트 내에서 챕터 전환 시 같은 라우트 유지.
 */

import { useParams } from "next/navigation";
import { BStudioShell } from "@/components/b/BStudioShell";
import { BCustomChapterEditor } from "@/components/custom-editor/BCustomChapterEditor";
import { useCustomOutline } from "@/components/custom-editor/useCustomOutline";

export default function BCustomWorkDetailPage() {
    const params = useParams<{ id: string }>();
    const projectId = params.id;

    // DOM 파생 아웃라인 — CustomEditor 스크롤 컨테이너(.custom-editor-scroll)에서
    // [data-heading-level] 요소를 스캔해 items / activeIndex / selectItem 을 제공한다.
    const outline = useCustomOutline(".custom-editor-scroll");

    return (
        <>
            {/* 실험 경고 배너 — 기존 마크/리스트 본문은 평문 평탄화됨. */}
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                자체 에디터(실험) — 프레시 테스트 챕터에서만 사용. 기존 마크·리스트 본문은 평문 평탄화됩니다.
            </div>
            <BStudioShell
                outline={outline}
                chapterUrlBase={`/b/works/${projectId}/custom`}
                renderEditor={({ currentChapterId, projectId: pid, paperSize, chapterTitle, onChapterRename, onSyncStatus, onConflict }) => (
                    <BCustomChapterEditor
                        key={currentChapterId}
                        currentChapterId={currentChapterId}
                        projectId={pid}
                        paperSize={paperSize}
                        chapterTitle={chapterTitle}
                        onChapterRename={onChapterRename}
                        onSyncStatus={onSyncStatus}
                        onConflict={onConflict}
                    />
                )}
            />
        </>
    );
}
