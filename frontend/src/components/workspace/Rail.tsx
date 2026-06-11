"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { QuickCapture } from "@/components/QuickCapture";
import { getLastProject } from "@/lib/lastProject";

/** 화면 전환 rail — desktop Rail 이식(web 라우팅). 하단 잉크 버튼 = 빠른 메모 캡처(QuickCapture). */
type Item = { key: string; label: string; href: string; match: (p: string) => boolean; icon: ReactNode };

/** 집필실 경로(`/projects/{id}/write`)면 그 작품 id 를 캡처 기본 연결 대상으로 쓴다. 아니면 미연결(null). */
function activeProjectIdFrom(pathname: string): number | null {
    const m = pathname.match(/^\/projects\/(\d+)\/write/);
    return m ? Number(m[1]) : null;
}

const ITEMS: Item[] = [
    {
        key: "home",
        label: "홈",
        href: "/",
        match: (p) => p === "/",
        icon: (
            <>
                <path d="M3 11.5 12 4l9 7.5" />
                <path d="M5.5 10.5V20h13v-9.5" />
            </>
        ),
    },
    {
        key: "projects",
        label: "작품",
        href: "/library",
        match: (p) => p.startsWith("/library"),
        icon: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
    },
    {
        key: "write",
        label: "집필",
        href: "/",
        match: (p) => p.includes("/write"),
        icon: (
            <>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </>
        ),
    },
    {
        key: "characters",
        label: "인물",
        href: "/library",
        match: (p) => p.includes("/characters"),
        icon: (
            <>
                <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
                <circle cx="9.5" cy="7" r="3.5" />
                <path d="M21 19v-1a4 4 0 0 0-3-3.85" />
            </>
        ),
    },
    { key: "memo", label: "메모", href: "/memos", match: (p) => p.startsWith("/memos"), icon: <path d="M4 5h16M4 12h16M4 19h10" /> },
    {
        key: "log",
        label: "기록",
        href: "/logs",
        match: (p) => p.startsWith("/logs"),
        icon: (
            <>
                <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7.5 4" />
                <path d="M3 4v3.5h3.5" />
                <path d="M12 8v4l3 2" />
            </>
        ),
    },
    {
        key: "contact",
        label: "문의",
        href: "/contact",
        match: (p) => p.startsWith("/contact"),
        icon: (
            <>
                <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
                <path d="m3.5 6.5 8.5 6 8.5-6" />
            </>
        ),
    },
];

export function Rail() {
    const pathname = usePathname();
    const router = useRouter();
    const [captureOpen, setCaptureOpen] = useState(false);

    // "집필"은 전역 활성작품이 없어 마지막으로 연 작품의 집필실로 보낸다(없으면 홈 — 재진입 허브가 그 역할).
    const handleNav = (item: Item) => {
        if (item.key === "write") {
            const last = getLastProject();
            router.push(last !== null ? `/projects/${last}/write` : "/");
            return;
        }
        // 인물은 작품 종속 — 마지막 연 작품의 인물 화면으로, 없으면 작품 벽에서 작품을 고르게 한다.
        if (item.key === "characters") {
            const last = getLastProject();
            router.push(last !== null ? `/projects/${last}/characters` : "/library");
            return;
        }
        router.push(item.href);
    };

    return (
        <nav className="rail" aria-label="화면 전환">
            <div className="rail__mark" aria-hidden="true" title="나래 노트">
                <span className="rail__logo" />
            </div>
            <div className="rail__nav">
                {ITEMS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className="rail__item"
                        aria-current={item.match(pathname) ? "page" : undefined}
                        onClick={() => handleNav(item)}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            {item.icon}
                        </svg>
                        <span>{item.label}</span>
                    </button>
                ))}
            </div>
            <button type="button" className="rail__ink" onClick={() => setCaptureOpen(true)} aria-label="빠른 메모">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 3.2c.38 0 .72.21.9.55 1.06 2.02 4.6 7.1 4.6 10.45a5.5 5.5 0 0 1-11 0c0-3.35 3.54-8.43 4.6-10.45.18-.34.52-.55.9-.55Z" />
                </svg>
                <span className="rail__ink-label">잉크 한 방울</span>
            </button>

            {captureOpen && (
                <QuickCapture activeProjectId={activeProjectIdFrom(pathname)} onClose={() => setCaptureOpen(false)} />
            )}
        </nav>
    );
}
