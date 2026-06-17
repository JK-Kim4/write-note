"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { QuickCapture } from "@/components/QuickCapture";
import { Toast } from "@/components/ui/Toast";
import { getLastProject } from "@/lib/lastProject";

/** 화면 전환 rail — desktop Rail 이식(web 라우팅). 하단 잉크 버튼 = 빠른 메모 캡처(QuickCapture). */
type Item = { key: string; label: string; href: string; match: (p: string) => boolean; icon: ReactNode };

/**
 * 현재 경로의 작품 컨텍스트(`/projects/{id}` 이하 전부) — 집필·인물 네비 목적지와 캡처 기본 연결 대상.
 * 019 버그픽스 A: write 한정이던 것을 작품 경로 전체로 일반화(작품 상세·edit·characters 포함).
 */
function activeProjectIdFrom(pathname: string): number | null {
    const m = pathname.match(/^\/projects\/(\d+)(?:\/|$)/);
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
        // 작품 벽 + 작품 상세·메타 편집까지 "작품" 영역 (집필실/인물은 각자 항목이 매칭).
        match: (p) => p.startsWith("/library") || /^\/projects\/\d+(\/edit)?$/.test(p),
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
    {
        key: "settings",
        label: "설정",
        href: "/settings",
        match: (p) => p.startsWith("/settings"),
        icon: (
            <>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.88Z" />
            </>
        ),
    },
];

export function Rail() {
    const pathname = usePathname();
    const router = useRouter();
    const [captureOpen, setCaptureOpen] = useState(false);
    // 빈 컨텍스트 안내 — seq 로 재클릭마다 Toast remount(타이머 재시작).
    const [noProjectHint, setNoProjectHint] = useState<{ message: string; seq: number } | null>(null);

    // 집필·인물은 작품 종속 — ① 현재 경로의 작품 → ② 마지막으로 연 작품 → ③ 컨텍스트 없으면 이동하지 않고
    // 안내 토스트("작품 벽으로" 액션 포함). 묵음 이동(홈/작품벽)이 "이상한 메뉴로 간다"는 혼란을 줬던 회귀의 픽스.
    const handleNav = (item: Item) => {
        if (item.key === "write" || item.key === "characters") {
            const projectId = activeProjectIdFrom(pathname) ?? getLastProject();
            if (projectId === null) {
                const message = item.key === "write" ? "집필할 작품이 아직 없어요." : "인물을 둘 작품이 아직 없어요.";
                setNoProjectHint((prev) => ({ message, seq: (prev?.seq ?? 0) + 1 }));
                return;
            }
            const section = item.key === "write" ? "write" : "characters";
            router.push(`/projects/${projectId}/${section}`);
            return;
        }
        router.push(item.href);
    };

    return (
        <nav className="rail" aria-label="화면 전환">
            <div className="rail__mark" aria-hidden="true" title="소설빙">
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

            {noProjectHint && (
                <Toast
                    key={noProjectHint.seq}
                    message={noProjectHint.message}
                    actionLabel="작품 벽으로"
                    onAction={() => {
                        setNoProjectHint(null);
                        router.push("/library");
                    }}
                    onDismiss={() => setNoProjectHint(null)}
                />
            )}
        </nav>
    );
}
