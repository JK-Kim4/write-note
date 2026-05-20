"use client";

import { useAuthGuard } from "@/lib/auth/guard";
import { TopBar } from "@/components/shell/TopBar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

/**
 * Memo inbox page — wireframe.html 의 "메모 inbox" 탭 정적 외관.
 *
 * Spec reference: contracts/route-surfaces.md §2-3
 * 본 spec 단계는 정적 placeholder. 실제 큐레이션 동작은 Week 4 영역.
 */

const FILTER_CHIPS = [
    { id: "all", label: "전체", count: 0 },
    { id: "unsorted", label: "미분류", count: 0 },
    { id: "today", label: "오늘", count: 0 },
];

const PLACEHOLDER_MEMOS = [
    { id: 1, body: "할머니가 손녀에게 옛 사진을 건네는 장면.", source: "📱", at: "어제 23:11" },
    { id: 2, body: "지하철에서 본 두 노인의 대화 — 톤이 따뜻한데 끝이 쓸쓸함.", source: "💻", at: "그제 09:42" },
];

export default function MemosPage() {
    useAuthGuard("requireAuth");
    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--w-parchment)" }}>
            <TopBar title="메모 inbox" actions={<ThemeToggle />} />
            <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
                <div className="flex gap-2 mb-6">
                    {FILTER_CHIPS.map((chip, idx) => (
                        <button
                            key={chip.id}
                            type="button"
                            className="px-4 py-2 rounded-button-pill text-sm font-semibold"
                            style={{
                                backgroundColor:
                                    idx === 0 ? "var(--w-ink)" : "var(--w-canvas)",
                                color: idx === 0 ? "var(--w-canvas)" : "var(--w-ink)",
                                border: "1px solid var(--w-hairline)",
                            }}
                        >
                            {chip.label}
                            <span style={{ marginLeft: 6, opacity: 0.7 }}>{chip.count}</span>
                        </button>
                    ))}
                </div>
                <ul className="flex flex-col gap-3">
                    {PLACEHOLDER_MEMOS.map((m) => (
                        <li
                            key={m.id}
                            className="p-5 rounded-card-memo"
                            style={{
                                backgroundColor: "var(--w-canvas)",
                                border: "1px solid var(--w-hairline)",
                            }}
                        >
                            <p style={{ color: "var(--w-ink)", lineHeight: 1.6 }}>{m.body}</p>
                            <div
                                className="flex items-center gap-3 mt-3"
                                style={{ fontSize: "12px", color: "var(--w-ink)", opacity: 0.5 }}
                            >
                                <span>{m.source}</span>
                                <span>{m.at}</span>
                                <span style={{ marginLeft: "auto" }}>분류하기 →</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </main>
        </div>
    );
}
