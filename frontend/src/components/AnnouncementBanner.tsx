"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";
import { useLatestAnnouncement } from "@/lib/query/useAnnouncements";

/**
 * 홈 상단 공지 배너 (030 US1) — 최신 공개 공지 1건. 공개 공지가 없으면 미표시(FR-004).
 * 클릭 시 해당 공지 상세(/notice/[id])로 이동.
 */
export function AnnouncementBanner() {
    const { data } = useLatestAnnouncement();
    if (!data) return null;
    return (
        <Link
            href={`/notice/${data.id}`}
            className="mb-4 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm text-teal-900 transition-colors hover:bg-teal-100"
        >
            <Megaphone size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-teal-700" />
            <span className="shrink-0 font-medium">공지</span>
            <span className="truncate text-teal-800">{data.title}</span>
        </Link>
    );
}
