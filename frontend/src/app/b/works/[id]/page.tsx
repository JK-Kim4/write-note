"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorOutline } from "@/components/editor/useEditorOutline";
import { BChapterEditor } from "@/components/b/BChapterEditor";
import { BStudioShell } from "@/components/b/BStudioShell";

/**
 * B타입 집필 화면 — fable-test WorkDetailPage 3패널: [목차 w-64 | 에디터 | 메모·인물 w-80].
 *
 * 024 US1: 셸·챕터관리·세션 오케스트레이션은 `BStudioShell` 로 추출됐다.
 * 본 라우트는 TipTap 에디터(`BChapterEditor`)와 에디터 파생 아웃라인(`useEditorOutline`)을
 * 셸에 주입하는 얇은 래퍼다. 자체엔진 라우트는 같은 셸에 엔진 코어·엔진 파생 아웃라인을 주입한다.
 *
 * 022 방안 A: 에디터를 `key={currentChapterId}` 로 리마운트해 챕터 전환 시 세션을 재초기화(거짓 409 제거).
 */

export default function BWorkDetailPage() {
    // 에디터 인스턴스를 올려 목차 파생(useEditorOutline)에 사용. B 디자인 스크롤 컨테이너는 .b-editor-scroll.
    const [editor, setEditor] = useState<Editor | null>(null);
    const outline = useEditorOutline(editor, ".b-editor-scroll");

    return (
        <BStudioShell
            outline={outline}
            renderEditor={({ currentChapterId, projectId, paperSize, chapterTitle, onChapterRename, onSyncStatus, onConflict }) => (
                <BChapterEditor
                    key={currentChapterId}
                    documentId={currentChapterId}
                    projectId={projectId}
                    paperSize={paperSize}
                    chapterTitle={chapterTitle}
                    onChapterRename={onChapterRename}
                    onSyncStatus={onSyncStatus}
                    onConflict={onConflict}
                    onEditorReady={setEditor}
                />
            )}
        />
    );
}
