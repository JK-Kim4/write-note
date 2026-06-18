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

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BStudioShell } from "@/components/b/BStudioShell";
import { BCustomChapterEditor } from "@/components/custom-editor/BCustomChapterEditor";
import type { CustomEditorRef } from "@/components/custom-editor/CustomEditor";
import { useCustomOutline } from "@/components/custom-editor/useCustomOutline";

export default function BWorkDetailPage() {
    // DOM 파생 아웃라인 — CustomEditor 스크롤 컨테이너(.custom-editor-scroll)의
    // [data-heading-level] 요소를 스캔해 items / activeIndex / selectItem 을 제공한다.
    const outline = useCustomOutline(".custom-editor-scroll");
    // 목차 클릭 → 에디터 caret 점프(heading 끝). 셸(BStudioShell)은 outline.selectItem 을 클릭에서
    // 호출하므로, selectItem 을 래핑해 jumpToHeading 도 함께 부른다(스크롤·포커스는 에디터가 주도).
    const editorRef = useRef<CustomEditorRef>(null);
    const outlineWithJump = useMemo(
        () => ({
            ...outline,
            selectItem: (item: Parameters<typeof outline.selectItem>[0]) => {
                editorRef.current?.jumpToHeading(item.index);
                outline.selectItem(item);
            },
        }),
        [outline],
    );

    // iOS(WebKit, EditContext 미지원)는 자체 글쓰기 엔진 미지원 → 집필실 자체를 열지 않는다(읽기 전용도 아님,
    // 사용자 결정 2026-06-18). mounted 게이트로 SSR/hydration mismatch 회피(서버=항상 미지원).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const editingUnsupported = mounted && typeof EditContext === "undefined";

    if (editingUnsupported) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
                <h1 className="text-lg font-bold text-gray-900">이 기기에서는 집필실을 열 수 없어요</h1>
                <p className="max-w-sm text-sm text-gray-600">
                    자체 글쓰기 엔진은 아직 iOS(아이폰·아이패드) 브라우저를 지원하지 않아요. 데스크톱 Chrome·Edge
                    또는 안드로이드 Chrome에서 집필해 주세요.
                </p>
                <div className="flex gap-2">
                    <Link
                        href="/b/library"
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                        작품 목록
                    </Link>
                    <Link
                        href="/b"
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        홈
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <BStudioShell
            outline={outlineWithJump}
            renderEditor={({ currentChapterId, projectId, paperSize, chapterTitle, onChapterRename, onSyncStatus, onConflict }) => (
                <BCustomChapterEditor
                    key={currentChapterId}
                    ref={editorRef}
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
