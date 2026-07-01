"use client";

import Link from "next/link";
import { Megaphone, Pin } from "lucide-react";
import { useHomeAnnouncements } from "@/lib/query/useAnnouncements";
import type { AnnouncementSummary } from "@/lib/api/announcements";

/**
 * 홈 상단 공지 배너 (049) — 고정 슬롯 1건 + 최신 슬롯 1건.
 * 최신(일반) 공지는 기존 운영 배너와 동일한 옅은 청록(teal) pill 로 색을 유지하고,
 * 고정 공지는 앰버/골드(amber) 계열로 대비되게 강조(채운 배경·좌측 바·채운 「고정」 배지)해 구분한다.
 * 두 슬롯 모두 고정 밝은 배경 + 고정 어두운 텍스트(teal-800 / amber-900)라 라이트·다크 양쪽에서 가독성이 유지된다.
 * 서버(`GET /api/announcements/home`)가 pick·중복 제외를 담당 — FE 는 받은 두 값을 렌더만 한다.
 * 둘 다 없으면 미표시. 시각 SoT = docs/research/2026-07-01-announcement-pinned-latest-mockup.html.
 */
export function AnnouncementBanner() {
    const { data } = useHomeAnnouncements();
    const pinned = data?.pinned ?? null;
    const latest = data?.latest ?? null;
    if (!pinned && !latest) return null;

    return (
        <div className="mb-4 flex flex-col gap-2">
            {pinned && <PinnedSlot item={pinned} />}
            {latest && <LatestSlot item={latest} />}
        </div>
    );
}

/** 고정 슬롯 — 앰버/골드(amber) 강조(채운 배경 + 좌측 컬러 바 + 채운 「고정」 배지 + 진한 제목). 고정 색이라 다크에서도 가독. */
function PinnedSlot({ item }: { item: AnnouncementSummary }) {
    return (
        <Link
            href={`/notice/${item.id}`}
            className="relative flex items-center gap-2.5 overflow-hidden rounded-lg border border-[#f2d391] border-l-4 border-l-[#e0a53b] bg-[#fef6e7] px-4 py-3 text-[15px] text-[#78350f] transition-colors hover:bg-[#fdeecd]"
        >
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#b7791f] px-2 py-0.5 text-xs font-bold text-white">
                <Pin size={12} strokeWidth={2.25} aria-hidden />
                고정
            </span>
            <span className="min-w-0 flex-1 truncate font-bold">{item.title}</span>
        </Link>
    );
}

/** 최신 슬롯 — 기존 운영 배너와 동일한 옅은 청록 pill(인라인 「공지」). */
function LatestSlot({ item }: { item: AnnouncementSummary }) {
    return (
        <Link
            href={`/notice/${item.id}`}
            className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm text-teal-900 transition-colors hover:bg-teal-100"
        >
            <Megaphone size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-teal-700" />
            <span className="shrink-0 font-medium">공지</span>
            <span className="min-w-0 flex-1 truncate text-teal-800">{item.title}</span>
        </Link>
    );
}
