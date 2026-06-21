"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useAdminUser } from "@/lib/query/useAdminUsers";

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
        new Date(iso),
    );
}

export default function UserDetailPage() {
    const params = useParams<{ id: string }>();
    const id = Number(params.id);
    const { data, isLoading, isError } = useAdminUser(id);

    return (
        <div className="max-w-xl">
            <Link href="/users" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
                <ChevronLeft size={16} aria-hidden />
                회원 조회
            </Link>

            {isLoading && <p className="text-sm text-slate-500">불러오는 중…</p>}
            {isError && <p className="text-sm text-slate-500">회원을 찾을 수 없습니다.</p>}

            {data && (
                <div className="rounded-lg border border-slate-200 bg-white p-6">
                    <h1 className="mb-4 text-lg font-bold text-slate-900">{data.email}</h1>
                    <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
                        <dt className="text-slate-500">로그인 방식</dt>
                        <dd className="text-slate-800">{data.kakaoLinked ? "카카오 연동" : "이메일"}</dd>
                        <dt className="text-slate-500">이메일 인증</dt>
                        <dd className="text-slate-800">{data.emailVerified ? "인증됨" : "미인증"}</dd>
                        <dt className="text-slate-500">작품 수</dt>
                        <dd className="text-slate-800">{data.projectCount}</dd>
                        <dt className="text-slate-500">마지막 로그인</dt>
                        <dd className="text-slate-800">{formatDate(data.lastLoginAt)}</dd>
                        <dt className="text-slate-500">가입일</dt>
                        <dd className="text-slate-800">{formatDate(data.createdAt)}</dd>
                    </dl>
                </div>
            )}
        </div>
    );
}
