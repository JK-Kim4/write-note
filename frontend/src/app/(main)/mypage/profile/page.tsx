"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";
import { NicknameSection } from "@/components/mypage/NicknameSection";
import { AccountInfoSection } from "@/components/mypage/AccountInfoSection";

/**
 * 마이페이지 프로필 섹션 (037) — 닉네임 변경(036) + 계정정보(이메일·가입방식·가입일).
 * 데이터는 ["auth","me"] 쿼리 재사용 — 닉네임 변경 성공 시 무효화로 갱신.
 */
export default function ProfilePage() {
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

    return (
        <div className="flex flex-col gap-4">
            {/* nickname 을 key 로 — 변경 후 무효화·refetch 되면 리마운트되어 입력 초기값이 갱신된다. */}
            <NicknameSection key={meQuery.data.nickname} currentNickname={meQuery.data.nickname} />
            <AccountInfoSection
                email={meQuery.data.email}
                kakaoLinked={meQuery.data.kakaoLinked}
                createdAt={meQuery.data.createdAt}
            />
        </div>
    );
}
