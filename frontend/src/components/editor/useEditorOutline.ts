"use client";

import { useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { outlineFromDoc, type OutlineItem } from "@/lib/editor/outline";

/**
 * 아웃라인 editor 글루 (017 US1) — 라이브 에디터에서 목차 파생(디바운스)·현재 섹션 추적·점프.
 *
 * 파생 로직은 순수함수 outlineFromDoc(단위 테스트 보유)에 위임. 본 훅은 에디터 결선(구독/스크롤/점프)만.
 * 점프 pos 는 라이브 doc 에서 index 번째 heading 위치를 해결(JSON 위치 산술 재현 회피).
 */
export function useEditorOutline(
    editor: Editor | null,
    /** 현재 섹션 추적용 스크롤 컨테이너 선택자 — 기본은 집필실(.editor-scroll), B 디자인은 자체 클래스 전달. */
    scrollSelector: string = ".editor-scroll",
): {
    items: OutlineItem[];
    activeIndex: number | null;
    selectItem: (item: OutlineItem) => void;
} {
    const [items, setItems] = useState<OutlineItem[]>([]);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    // 목차 파생 — 'update' 구독 + 디바운스. 조합 중에도 doc 은 갱신되나 재파생은 디바운스라 입력 체감 무손상.
    useEffect(() => {
        // editor 없으면 빈 목차로 동기화(함수 경유 — 외부 시스템 스냅샷을 React 로 반영).
        const recompute = () => setItems(editor ? outlineFromDoc(JSON.stringify(editor.getJSON())) : []);
        recompute();
        if (!editor) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const onUpdate = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(recompute, 200);
        };
        editor.on("update", onUpdate);
        return () => {
            if (timer) clearTimeout(timer);
            editor.off("update", onUpdate);
        };
    }, [editor]);

    // 현재 섹션 추적 — 스크롤 컨테이너(scrollSelector) 상단 위 마지막 heading.
    useEffect(() => {
        if (!editor) return;
        const pmDom = editor.view.dom as HTMLElement;
        const scrollEl = pmDom.closest<HTMLElement>(scrollSelector);
        if (!scrollEl) return;
        let raf = 0;
        const measure = () => {
            raf = 0;
            const headings = Array.from(pmDom.querySelectorAll<HTMLElement>("h1, h2, h3"));
            if (headings.length === 0) {
                setActiveIndex(null);
                return;
            }
            const top = scrollEl.getBoundingClientRect().top + 8;
            let current = 0;
            headings.forEach((h, i) => {
                if (h.getBoundingClientRect().top <= top) current = i;
            });
            setActiveIndex(current);
        };
        const onScroll = () => {
            if (raf) return;
            raf = requestAnimationFrame(measure);
        };
        measure();
        scrollEl.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            if (raf) cancelAnimationFrame(raf);
            scrollEl.removeEventListener("scroll", onScroll);
        };
    }, [editor, items.length, scrollSelector]);

    // 점프 — index 번째 level1·2·3 heading 위치 해결 → 커서 이동 + 스크롤(reduced-motion 시 즉시).
    const selectItem = useCallback(
        (item: OutlineItem) => {
            if (!editor) return;
            const positions: number[] = [];
            editor.state.doc.descendants((node, pos) => {
                if (
                    node.type.name === "heading" &&
                    (node.attrs.level === 1 || node.attrs.level === 2 || node.attrs.level === 3)
                ) {
                    positions.push(pos);
                }
                return true;
            });
            const pos = positions[item.index];
            if (pos == null) return;
            // 커서 이동(선택 변경 → 자동저장 비트리거). +1 = heading 내부 선택 가능 위치.
            editor.chain().setTextSelection(pos + 1).focus().run();
            // 스크롤은 heading DOM 으로 — reduced-motion 이면 즉시.
            const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
            if (dom?.scrollIntoView) {
                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                dom.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
            }
        },
        [editor],
    );

    return { items, activeIndex, selectItem };
}
