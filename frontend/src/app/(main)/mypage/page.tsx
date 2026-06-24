"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";
import { NicknameSection } from "@/components/mypage/NicknameSection";
import { AccountInfoSection } from "@/components/mypage/AccountInfoSection";

/**
 * 마이페이지 (036) — 계정·신원 영역. 닉네임 변경 + 계정 정보(이메일·가입방식·가입일).
 * 앱 동작 설정(/settings)과 분리. 인증 가드는 (main) 레이아웃(useAuthGuard)이 처리한다.
 * 데이터는 ["auth","me"] 쿼리 재사용 — 닉네임 변경 성공 시 무효화로 갱신.
 */
export default function MyPage() {
    const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe, retry: false });

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="mb-6 text-xl font-bold">마이페이지</h1>

            {meQuery.isPending ? (
                <p className="text-sm text-gray-400">불러오는 중…</p>
            ) : meQuery.data ? (
                <>
                    {/* nickname 을 key 로 — 변경 후 무효화·refetch 되면 리마운트되어 입력 초기값이 갱신된다. */}
                    <NicknameSection key={meQuery.data.nickname} currentNickname={meQuery.data.nickname} />
                    <AccountInfoSection
                        email={meQuery.data.email}
                        kakaoLinked={meQuery.data.kakaoLinked}
                        createdAt={meQuery.data.createdAt}
                    />
                </>
            ) : (
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
            )}
        </div>
    );
}
