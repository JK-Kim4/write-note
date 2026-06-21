"use client";

import Link from "next/link";
import { useAdminAnnouncements, useDeleteAnnouncement } from "@/lib/query/useAdminAnnouncements";

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(iso));
}

export default function AnnouncementsPage() {
    const { data, isLoading, isError } = useAdminAnnouncements();
    const del = useDeleteAnnouncement();

    const handleDelete = (id: number, title: string) => {
        if (!window.confirm(`"${title}" 공지를 삭제할까요?`)) return;
        del.mutate(id);
    };

    return (
        <div>
            <div className="mb-5 flex items-center justify-between">
                <h1 className="text-lg font-bold text-slate-900">공지 관리</h1>
                <Link href="/announcements/new" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700">
                    새 공지
                </Link>
            </div>

            {isLoading && <p className="text-sm text-slate-500">불러오는 중…</p>}
            {isError && <p className="text-sm text-slate-500">공지를 불러오지 못했습니다.</p>}

            {data && data.content.length === 0 && (
                <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    작성된 공지가 없습니다.
                </p>
            )}

            {data && data.content.length > 0 && (
                <table className="w-full border-collapse overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                            <th className="px-4 py-2 font-medium">제목</th>
                            <th className="px-4 py-2 font-medium">상태</th>
                            <th className="px-4 py-2 font-medium">생성</th>
                            <th className="px-4 py-2 font-medium text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.content.map((a) => (
                            <tr key={a.id} className="border-b border-slate-100 last:border-0">
                                <td className="px-4 py-3 text-slate-900">{a.title}</td>
                                <td className="px-4 py-3">
                                    {a.isPublished ? (
                                        <span className="rounded bg-teal-50 px-2 py-0.5 text-xs text-teal-700">공개</span>
                                    ) : (
                                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">비공개</span>
                                    )}
                                    {a.isPinned && <span className="ml-1 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">고정</span>}
                                </td>
                                <td className="px-4 py-3 text-slate-400">{formatDate(a.createdAt)}</td>
                                <td className="px-4 py-3 text-right">
                                    <Link href={`/announcements/${a.id}/edit`} className="text-slate-600 hover:underline">수정</Link>
                                    <button
                                        onClick={() => handleDelete(a.id, a.title)}
                                        disabled={del.isPending}
                                        className="ml-3 text-red-600 hover:underline disabled:opacity-50"
                                    >
                                        삭제
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
