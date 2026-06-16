"use client";

/**
 * B형 집필 화면 — 자체 EditContext 엔진(기본). 024 R4 에서 TipTap → 자체 엔진 전면 교체.
 *
 * BStudioShell 에 BCustomChapterEditor(자체엔진)를 주입하는 얇은 래퍼.
 * - 챕터 관리·세션·충돌·작업종료·export·쪽지/인물 패널은 BStudioShell 이 처리.
 * - 아웃라인은 useCustomOutline(DOM 파생): items / activeIndex / selectItem.
 * - chapterUrlBase 생략 → 기본 `/b/works/[id]` 유지(챕터 전환 시 같은 라우트).
 *
 * 챕터 전환 시 BCustomChapterEditor 를 `key={currentChapterId}` 로 리마운트해 세션 재초기화
 * (022 거짓 409 제거).
 */

import { BStudioShell } from "@/components/b/BStudioShell";
import { BCustomChapterEditor } from "@/components/custom-editor/BCustomChapterEditor";
import { useCustomOutline } from "@/components/custom-editor/useCustomOutline";

export default function BWorkDetailPage() {
    // DOM 파생 아웃라인 — CustomEditor 스크롤 컨테이너(.custom-editor-scroll)의
    // [data-heading-level] 요소를 스캔해 items / activeIndex / selectItem 을 제공한다.
    const outline = useCustomOutline(".custom-editor-scroll");

    return (
        <BStudioShell
            outline={outline}
            renderEditor={({ currentChapterId, projectId, paperSize, chapterTitle, onChapterRename, onSyncStatus, onConflict }) => (
                <BCustomChapterEditor
                    key={currentChapterId}
                    currentChapterId={currentChapterId}
                    projectId={projectId}
                    paperSize={paperSize}
                    chapterTitle={chapterTitle}
                    onChapterRename={onChapterRename}
                    onSyncStatus={onSyncStatus}
                    onConflict={onConflict}
                />
            )}
        />
    );
}
