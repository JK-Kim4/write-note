"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OutlineItem } from "@/lib/editor/outline";

/**
 * 자체 에디터 — 렌더된 DOM 에서 heading fragment 를 긁어 목차를 파생한다.
 *
 * `useEditorOutline`(TipTap 기반)의 DOM 파생 버전. 모델 lifting 없이 디커플.
 * - items: `[data-heading-level]` 요소를 document 순서로 스캔.
 * - selectItem: 클릭 점프 (scrollIntoView smooth).
 * - activeIndex: 스크롤 이벤트 + getBoundingClientRect 로 현재 섹션 추적.
 *
 * @param scrollSelector - overflow:auto 스크롤 컨테이너 CSS 선택자(예: ".custom-editor-scroll").
 */
export function useCustomOutline(scrollSelector: string): {
    items: OutlineItem[];
    activeIndex: number | null;
    selectItem: (item: OutlineItem) => void;
} {
    const [items, setItems] = useState<OutlineItem[]>([]);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    // items 스캔 — 컨테이너 내 [data-heading-level] 요소를 document 순으로 수집.
    const scan = useCallback(() => {
        const container = document.querySelector(scrollSelector);
        if (!container) {
            setItems([]);
            return;
        }
        const els = Array.from(container.querySelectorAll<HTMLElement>("[data-heading-level]"));
        const next: OutlineItem[] = els.map((el, i) => ({
            level: Number(el.dataset.headingLevel) as 1 | 2 | 3,
            text: (el.textContent ?? "").trim(),
            index: i,
        }));
        setItems(next);
    }, [scrollSelector]);

    // MutationObserver — heading 추가/삭제/텍스트 변경 시 재스캔(200ms 디바운스).
    // document.body 를 관찰한다 — 스크롤 컨테이너는 챕터 로딩 후 비동기로 마운트되므로(에디터가
    // 늦게 뜸), 컨테이너에 직접 붙이면 마운트 시점에 컨테이너 부재 → 영구 미스. body 관찰이 에디터
    // 마운트(childList)와 이후 heading 변경을 모두 잡는다. scan 은 full selector 로 매번 재조회.
    useEffect(() => {
        scan();

        let timer: ReturnType<typeof setTimeout> | undefined;
        const debounced = () => {
            // trailing-only 디바운스 — leading(즉시) scan 은 setItems→리렌더→목차 DOM 변경→
            // 본 MutationObserver(body subtree) 재트리거 → 무한 루프(2026-06-16 crash 회귀)라 금지.
            if (timer) clearTimeout(timer);
            timer = setTimeout(scan, 200);
        };

        const observer = new MutationObserver(debounced);
        observer.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["data-heading-level"],
        });

        return () => {
            observer.disconnect();
            if (timer) clearTimeout(timer);
        };
    }, [scan]);

    // 스크롤 이벤트 — 현재 섹션(activeIndex) 추적.
    useEffect(() => {
        const container = document.querySelector<HTMLElement>(scrollSelector);
        if (!container) return;

        let timer: ReturnType<typeof setTimeout> | undefined;
        const measure = () => {
            const els = Array.from(container.querySelectorAll<HTMLElement>("[data-heading-level]"));
            if (els.length === 0) {
                setActiveIndex(null);
                return;
            }
            const containerTop = container.getBoundingClientRect().top;
            let current = 0;
            els.forEach((el, i) => {
                if (el.getBoundingClientRect().top <= containerTop + 8) current = i;
            });
            setActiveIndex(current);
        };

        const onScroll = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(measure, 50);
        };

        measure();
        container.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            container.removeEventListener("scroll", onScroll);
            if (timer) clearTimeout(timer);
        };
    }, [scrollSelector, items.length]);

    // selectItem — 패널 하이라이트(activeIndex)만 갱신한다. 스크롤·포커스·caret 점프는 CustomEditor 가
    // jumpToHeading(caret collapse → sel.focus effect 의 즉시 scrollTop 보정)로 주도한다 — smooth
    // scrollIntoView 이벤트가 activeIndex measure 와 경합해 하이라이트가 튀던 문제를 제거.
    // useCallback 으로 안정화(매 렌더 새 인스턴스 → deps 불안정 → 무한루프 위험 회피).
    const selectItem = useCallback((item: OutlineItem) => {
        setActiveIndex(item.index);
    }, []);

    return { items, activeIndex, selectItem };
}
