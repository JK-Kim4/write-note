"use client";

/**
 * B형 집필 화면 — 자체 EditContext 엔진(기본). 024 R4 에서 TipTap → 자체 엔진 전면 교체.
 *
 * BStudioShell 에 BCustomChapterEditor(자체엔진)를 주입하는 얇은 래퍼.
 * - 033: 챕터 제거 — 작품 1개 = 본문 1개. 셸이 단일 본문 id 를 슬롯으로 넘긴다.
 * - 세션·충돌·작업종료·export·쪽지/인물 패널은 BStudioShell 이 처리.
 * - 아웃라인은 모델 파생: 에디터가 onOutlineChange 로 전체 문서 목차(items)를 올리고, page 가 패널에 전달.
 *   클릭 점프만 제공(activeIndex 강조 없음 — 페이지 넘김 뷰라 스크롤 기반 현재섹션 추적이 무의미).
 *
 * 에디터는 `key={documentId}` 로 리마운트해 세션을 본문 단위로 격리(016 거짓 409 제거).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BStudioShell } from "@/components/b/BStudioShell";
import { BCustomChapterEditor } from "@/components/custom-editor/BCustomChapterEditor";
import type { CustomEditorRef } from "@/components/custom-editor/CustomEditor";
import type { OutlineItem } from "@/lib/editor/outline";

export default function BWorkDetailPage() {
    // 모델 파생 아웃라인 — 에디터(BCustomChapterEditor)가 onOutlineChange 로 전체 문서 모델에서 파생한
    // 목차(여러 페이지에 걸친 heading 전부)를 올려준다. 기존 DOM 스캔(useCustomOutline)은 현재 보이는
    // 페이지 1장만 긁어 페이지 전환 시 목차가 초기화됐다 → 전체 작품 기준으로 교체.
    const [outlineItems, setOutlineItems] = useState<OutlineItem[]>([]);
    // 목차 클릭 → 에디터 caret 점프(heading 끝). item.index 는 outlineFromModel 의 heading 순번 =
    // jumpToHeading 의 view.blocks heading 순번과 동일(relayout 이 blockAttrs 순서를 보존) → 정확.
    // 페이지 넘김 뷰라 스크롤 기반 현재섹션 강조는 의미가 없어 activeIndex 는 null(강조 없음).
    const editorRef = useRef<CustomEditorRef>(null);
    const outline = useMemo(
        () => ({
            items: outlineItems,
            activeIndex: null,
            selectItem: (item: OutlineItem) => {
                editorRef.current?.jumpToHeading(item.index);
            },
        }),
        [outlineItems],
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
                        href="/library"
                        className="rounded-md bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700"
                    >
                        작품 목록
                    </Link>
                    <Link
                        href="/"
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
            outline={outline}
            focusEditor={() => editorRef.current?.focus()}
            renderEditor={({ currentChapterId, projectId, paperSize, fontScale, layoutMode, onWordCountChange, onSyncStatus, onConflict }) => (
                <BCustomChapterEditor
                    key={currentChapterId}
                    ref={editorRef}
                    currentChapterId={currentChapterId}
                    projectId={projectId}
                    paperSize={paperSize}
                    fontScale={fontScale}
                    layoutMode={layoutMode}
                    onWordCountChange={onWordCountChange}
                    onSyncStatus={onSyncStatus}
                    onConflict={onConflict}
                    onOutlineChange={setOutlineItems}
                />
            )}
        />
    );
}
