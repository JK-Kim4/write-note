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
            // ① leading: 챕터 전환(에디터 리마운트) 같은 큰 변경을 즉시 1회 반영(목차 늦은 렌더 해소)
            //    + trailing: 연속 변경(타자 중 heading 편집)은 200ms 로 수렴.
            scan();
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

    // selectItem — item.index 번째 [data-heading-level] 요소로 scrollIntoView.
    // useCallback 으로 안정화(매 렌더 새 인스턴스 → deps 불안정 → 무한루프 위험 회피).
    const selectItem = useCallback(
        (item: OutlineItem) => {
            const container = document.querySelector<HTMLElement>(scrollSelector);
            if (!container) return;
            const els = Array.from(container.querySelectorAll<HTMLElement>("[data-heading-level]"));
            const el = els[item.index];
            if (!el) return;
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
            // ② 클릭 즉시 패널 하이라이트 — smooth scroll 이벤트(measure)에만 의존하면 불안정/지연되므로 직접 설정.
            setActiveIndex(item.index);
            // ③ 점프 후 에디터로 포커스 복귀(scrollSelector 컨테이너 = stage, tabIndex=0). 없으면 포커스가
            // 목차 버튼에 남아 마우스로 본문을 클릭하기 전까지 키 입력이 안 된다. preventScroll 로 방금 점프 위치 보존.
            container.focus({ preventScroll: true });
        },
        [scrollSelector],
    );

    return { items, activeIndex, selectItem };
}
