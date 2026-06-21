"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AnnouncementForm } from "../../AnnouncementForm";
import { useAdminAnnouncements, useUpdateAnnouncement } from "@/lib/query/useAdminAnnouncements";
import type { AnnouncementInput } from "@/lib/api/announcements";

export default function EditAnnouncementPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = Number(params.id);
    const { data, isLoading } = useAdminAnnouncements();
    const update = useUpdateAnnouncement();
    const [error, setError] = useState<string | null>(null);

    const current = data?.content.find((a) => a.id === id);

    const handleSubmit = (input: AnnouncementInput) => {
        setError(null);
        update.mutate(
            { id, input },
            {
                onSuccess: () => router.replace("/announcements"),
                onError: () => setError("저장에 실패했습니다. 입력을 확인해주세요."),
            },
        );
    };

    return (
        <div>
            <Link href="/announcements" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                <ChevronLeft size={16} aria-hidden />
                공지 관리
            </Link>
            <h1 className="mb-5 text-lg font-bold text-slate-900">공지 수정</h1>

            {isLoading && <p className="text-sm text-slate-500">불러오는 중…</p>}
            {!isLoading && !current && <p className="text-sm text-slate-500">공지를 찾을 수 없습니다.</p>}
            {current && (
                <AnnouncementForm
                    initial={{
                        title: current.title,
                        body: current.body,
                        isPublished: current.isPublished,
                        isPinned: current.isPinned,
                    }}
                    submitLabel="저장"
                    submitting={update.isPending}
                    error={error}
                    onSubmit={handleSubmit}
                />
            )}
        </div>
    );
}
