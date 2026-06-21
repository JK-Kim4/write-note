"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listAdminAnnouncements } from "@/lib/api/announcements";
import { logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * 어드민 가드 셸 (030) — 로그인/관리자 권한 확인.
 * 비인증(401) → /login 리다이렉트. 비관리자(403) → 권한 안내. 백엔드가 최종 권위.
 */
const NAV = [
    { href: "/dashboard", label: "사용 현황" },
    { href: "/announcements", label: "공지 관리" },
    { href: "/users", label: "회원 조회" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const qc = useQueryClient();

    // 가드 핑 — 어드민 엔드포인트 1건으로 인증/권한 확인.
    const { isLoading, error } = useQuery({
        queryKey: ["admin", "guard"],
        queryFn: () => listAdminAnnouncements(0, 1),
        retry: false,
    });

    const status = error instanceof ApiError ? error.status : null;

    useEffect(() => {
        if (status === 401) router.replace("/login");
    }, [status, router]);

    const handleLogout = async () => {
        try {
            await logout();
        } finally {
            qc.clear();
            router.replace("/login");
        }
    };

    if (isLoading) {
        return <p className="p-8 text-sm text-slate-500">불러오는 중…</p>;
    }
    if (status === 401) {
        return null; // 리다이렉트 중
    }
    if (status === 403) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
                <p className="text-sm text-slate-700">관리자 권한이 없는 계정입니다.</p>
                <button onClick={handleLogout} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                    로그아웃
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
                    <span className="font-bold text-slate-900">소설비 운영</span>
                    <nav className="flex flex-1 items-center gap-1">
                        {NAV.map((item) => {
                            const active = pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`rounded-md px-3 py-1.5 text-sm ${active ? "bg-slate-900 font-medium text-white" : "text-slate-600 hover:bg-slate-100"}`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                    <button onClick={handleLogout} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
                        로그아웃
                    </button>
                </div>
            </header>
            <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </div>
    );
}
