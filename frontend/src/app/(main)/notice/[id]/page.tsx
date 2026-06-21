"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useAnnouncement } from "@/lib/query/useAnnouncements";

/**
 * 공지 상세 (030 US1) — 제목·공개일·본문. 비공개/없음은 안내.
 */
function formatDate(iso: string | null): string {
    if (!iso) return "";
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(iso));
}

export default function NoticeDetailPage() {
    const params = useParams<{ id: string }>();
    const id = Number(params.id);
    const { data, isLoading, isError } = useAnnouncement(id);

    return (
        <div className="mx-auto max-w-2xl">
            <Link
                href="/notice"
                className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-800"
            >
                <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
                공지 목록
            </Link>

            {isLoading && <p className="text-sm text-gray-500">불러오는 중…</p>}
            {isError && (
                <p className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
                    공지를 찾을 수 없습니다.
                </p>
            )}

            {data && (
                <article>
                    <h1 className="text-xl font-bold text-gray-900">{data.title}</h1>
                    <time className="mt-1 block text-xs text-gray-400">{formatDate(data.publishedAt)}</time>
                    <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{data.body}</div>
                </article>
            )}
        </div>
    );
}
