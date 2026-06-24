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
        return <p className="text-sm text-gray-400">불러오는 중…</p>;
    }
    if (!meQuery.data) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-sm text-gray-500">계정 정보를 불러올 수 없습니다.</p>
                <button
                    type="button"
                    onClick={() => meQuery.refetch()}
                    disabled={meQuery.isFetching}
                    className="mt-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                    다시 시도
                </button>
            </div>
        );
    }

    return <ConnectionsSection kakaoLinked={meQuery.data.kakaoLinked} passwordSet={meQuery.data.passwordSet} />;
}
