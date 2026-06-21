"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminUsers } from "@/lib/query/useAdminUsers";

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("ko-KR", { year: "2-digit", month: "short", day: "numeric" }).format(new Date(iso));
}

export default function UsersPage() {
    const [input, setInput] = useState("");
    const [q, setQ] = useState("");
    const [page, setPage] = useState(0);
    const { data, isLoading, isError } = useAdminUsers(page, q);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(0);
        setQ(input.trim());
    };

    return (
        <div>
            <h1 className="mb-5 text-lg font-bold text-slate-900">회원 조회</h1>

            <form onSubmit={submit} className="mb-4 flex gap-2">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="이메일 검색"
                    className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
                />
                <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                    검색
                </button>
            </form>

            {isLoading && <p className="text-sm text-slate-500">불러오는 중…</p>}
            {isError && <p className="text-sm text-slate-500">회원을 불러오지 못했습니다.</p>}

            {data && data.content.length === 0 && (
                <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    {q ? "검색 결과가 없습니다." : "회원이 없습니다."}
                </p>
            )}

            {data && data.content.length > 0 && (
                <>
                    <table className="w-full border-collapse overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                                <th className="px-4 py-2 font-medium">이메일</th>
                                <th className="px-4 py-2 font-medium">연동/인증</th>
                                <th className="px-4 py-2 font-medium">작품</th>
                                <th className="px-4 py-2 font-medium">마지막 로그인</th>
                                <th className="px-4 py-2 font-medium">가입</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.content.map((u) => (
                                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                                    <td className="px-4 py-3">
                                        <Link href={`/users/${u.id}`} className="text-slate-900 hover:underline">{u.email}</Link>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">
                                        {u.kakaoLinked ? "카카오" : "이메일"} · {u.emailVerified ? "인증됨" : "미인증"}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">{u.projectCount}</td>
                                    <td className="px-4 py-3 text-slate-400">{formatDate(u.lastLoginAt)}</td>
                                    <td className="px-4 py-3 text-slate-400">{formatDate(u.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                        <span>총 {data.totalElements}명</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
                            >
                                이전
                            </button>
                            <span>{page + 1} / {Math.max(1, data.totalPages)}</span>
                            <button
                                onClick={() => setPage((p) => (p + 1 < data.totalPages ? p + 1 : p))}
                                disabled={page + 1 >= data.totalPages}
                                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
                            >
                                다음
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
