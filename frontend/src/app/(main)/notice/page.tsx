"use client";

import Link from "next/link";
import { useAnnouncements } from "@/lib/query/useAnnouncements";

/**
 * 공지 목록 (030 US1) — 공개 공지 최신순. 항목 클릭 시 상세로 이동.
 */
function formatDate(iso: string | null): string {
    if (!iso) return "";
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
}

export default function NoticePage() {
    const { data, isLoading, isError } = useAnnouncements();

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="mb-6 text-xl font-bold text-gray-900">공지사항</h1>

            {isLoading && <p className="text-sm text-gray-500">불러오는 중…</p>}
            {isError && <p className="text-sm text-gray-500">공지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}

            {data && data.content.length === 0 && (
                <p className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
                    등록된 공지가 없습니다.
                </p>
            )}

            {data && data.content.length > 0 && (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                    {data.content.map((a) => (
                        <li key={a.id}>
                            <Link
                                href={`/notice/${a.id}`}
                                className="flex items-baseline justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-gray-50"
                            >
                                <span className="truncate text-sm text-gray-900">{a.title}</span>
                                <time className="shrink-0 text-xs text-gray-400">{formatDate(a.publishedAt)}</time>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
