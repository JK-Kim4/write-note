"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api/client";
import { useSharedView } from "@/lib/query/useShares";

/**
 * 공유 공개 진입(046 R5) — 토큰으로 공개 작품/시리즈 목록을 보여준다(비로그인 200).
 * work 링크면 단일 작품, series 링크면 공개로 고른 작품들. 본문은 작품 클릭으로 들어간다.
 */
type Props = { token: string };

export function SharedTokenView({ token }: Props) {
    const { data, isLoading, error } = useSharedView(token);

    if (isLoading) {
        return <p className="py-16 text-center text-sm text-muted">불러오는 중…</p>;
    }

    if (error || !data) {
        const gone = error instanceof ApiError && error.code === "SHARE_LINK_NOT_FOUND";
        return (
            <div className="mx-auto max-w-md rounded-xl border border-border bg-surface px-6 py-12 text-center">
                <p className="text-sm text-muted">
                    {gone ? "공유가 종료되었거나 존재하지 않는 링크예요." : "지금은 이 글을 불러올 수 없어요."}
                </p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl">
            <p className="text-xs text-faint">{data.targetType === "series" ? "시리즈 공유" : "작품 공유"}</p>
            <h1 className="mt-1 text-2xl font-bold text-ink">{data.title}</h1>

            {data.works.length === 0 ? (
                <p className="mt-8 rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
                    아직 공개된 글이 없어요.
                </p>
            ) : (
                <ul className="mt-6 space-y-3">
                    {data.works.map((w) => (
                        <li key={w.projectId}>
                            <Link
                                href={`/shared/${token}/works/${w.projectId}`}
                                className="block rounded-lg border border-border bg-surface px-4 py-4 transition-colors hover:border-border-strong hover:bg-surface-2"
                            >
                                <span className="text-base font-medium text-ink">{w.title}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
