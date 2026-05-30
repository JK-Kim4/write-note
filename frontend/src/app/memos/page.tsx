"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { listMemos } from "@/lib/api/memo";
import { TopBar } from "@/components/shell/TopBar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { MemoResponse } from "@/types/api";

/**
 * 메모 inbox page — 실데이터 결선 (006 US3 T048).
 *
 * - GET /api/memos 기본 목록 렌더 (페이지 0, size 50)
 * - 필터 칩 외관 유지 (실제 필터링은 US4 영역)
 * - 빈 상태 / 에러 상태 처리
 *
 * Spec reference: contracts/route-surfaces.md §2-3
 */

const FILTER_CHIPS = [
    { id: "all", label: "전체" },
    { id: "unsorted", label: "미분류" },
    { id: "today", label: "오늘" },
];

const SOURCE_LABEL: Record<string, string> = {
    DESKTOP: "💻",
    MOBILE: "📱",
};

const formatCapturedAt = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24 && date.getDate() === now.getDate()) {
        return `오늘 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth()) {
        return `어제 ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
};

function MemoCard({ memo }: { memo: MemoResponse }) {
    return (
        <li
            className="p-5 rounded-card-memo"
            style={{
                backgroundColor: "var(--w-canvas)",
                border: "1px solid var(--w-hairline)",
            }}
        >
            <p style={{ color: "var(--w-ink)", lineHeight: 1.6 }}>{memo.body}</p>
            <div
                className="flex items-center gap-3 mt-3"
                style={{ fontSize: "12px", color: "var(--w-ink)", opacity: 0.5 }}
            >
                <span>{SOURCE_LABEL[memo.source] ?? memo.source}</span>
                <span>{formatCapturedAt(memo.capturedAt)}</span>
                <span style={{ marginLeft: "auto" }}>분류하기 →</span>
            </div>
        </li>
    );
}

export default function MemosPage() {
    useAuthGuard("requireAuth");

    const memosQuery = useQuery({
        queryKey: ["memos", { page: 0, size: 50 }],
        queryFn: () => listMemos({ page: 0, size: 50 }),
        retry: false,
    });

    const memos = memosQuery.data?.content ?? [];
    const total = memosQuery.data?.totalElements ?? 0;

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
                            {idx === 0 && (
                                <span style={{ marginLeft: 6, opacity: 0.7 }}>{total}</span>
                            )}
                        </button>
                    ))}
                </div>

                {memosQuery.isLoading && (
                    <p style={{ color: "var(--w-ink)", opacity: 0.5, textAlign: "center", marginTop: "4rem" }}>
                        불러오는 중…
                    </p>
                )}

                {memosQuery.isError && (
                    <div style={{ textAlign: "center", marginTop: "4rem" }}>
                        <p style={{ color: "var(--w-ink)", opacity: 0.7 }}>메모를 불러오지 못했습니다.</p>
                        <button
                            type="button"
                            onClick={() => void memosQuery.refetch()}
                            className="mt-4 px-6 py-2 rounded-button-pill text-sm font-semibold"
                            style={{ backgroundColor: "var(--w-accent)", color: "var(--w-canvas)" }}
                        >
                            다시 시도
                        </button>
                    </div>
                )}

                {!memosQuery.isLoading && !memosQuery.isError && memos.length === 0 && (
                    <div style={{ textAlign: "center", marginTop: "4rem" }}>
                        <p style={{ color: "var(--w-ink)", opacity: 0.6, fontSize: "15px" }}>
                            아직 메모가 없습니다.
                        </p>
                        <p style={{ color: "var(--w-ink)", opacity: 0.4, fontSize: "13px", marginTop: "0.5rem" }}>
                            ⌘+N 으로 빠르게 캡처해 보세요.
                        </p>
                    </div>
                )}

                {memos.length > 0 && (
                    <ul className="flex flex-col gap-3">
                        {memos.map((m) => (
                            <MemoCard key={m.id} memo={m} />
                        ))}
                    </ul>
                )}
            </main>
        </div>
    );
}
