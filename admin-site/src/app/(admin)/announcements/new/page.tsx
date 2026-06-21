"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AnnouncementForm } from "../AnnouncementForm";
import { useCreateAnnouncement } from "@/lib/query/useAdminAnnouncements";
import type { AnnouncementInput } from "@/lib/api/announcements";

export default function NewAnnouncementPage() {
    const router = useRouter();
    const create = useCreateAnnouncement();
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (input: AnnouncementInput) => {
        setError(null);
        create.mutate(input, {
            onSuccess: () => router.replace("/announcements"),
            onError: () => setError("저장에 실패했습니다. 입력을 확인해주세요."),
        });
    };

    return (
        <div>
            <Link href="/announcements" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                <ChevronLeft size={16} aria-hidden />
                공지 관리
            </Link>
            <h1 className="mb-5 text-lg font-bold text-slate-900">새 공지</h1>
            <AnnouncementForm submitLabel="작성" submitting={create.isPending} error={error} onSubmit={handleSubmit} />
        </div>
    );
}
