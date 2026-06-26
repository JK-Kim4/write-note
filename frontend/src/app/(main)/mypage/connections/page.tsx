"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";
import { ConnectionsSection } from "@/components/mypage/ConnectionsSection";

/**
 * 마이페이지 계정 연결 섹션 (037 US3) — 연결 상태는 ["auth","me"] 의 kakaoLinked·passwordSet 로 파생.
 */
export default function ConnectionsPage() {
    const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe, retry: false });

    if (meQuery.isPending) {
        return <p className="text-sm text-faint">불러오는 중…</p>;
    }
    if (!meQuery.data) {
        return (
            <div className="rounded-xl border border-border bg-surface p-5">
                <p className="text-sm text-muted">계정 정보를 불러올 수 없습니다.</p>
                <button
                    type="button"
                    onClick={() => meQuery.refetch()}
                    disabled={meQuery.isFetching}
                    className="mt-2 rounded-md border border-border-strong px-3 py-1.5 text-sm text-muted-strong hover:bg-surface-2 disabled:opacity-50"
                >
                    다시 시도
                </button>
            </div>
        );
    }

    return <ConnectionsSection kakaoLinked={meQuery.data.kakaoLinked} passwordSet={meQuery.data.passwordSet} />;
}
