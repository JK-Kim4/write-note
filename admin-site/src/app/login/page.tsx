"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/** 어드민 로그인 (030) — 관리자 계정으로 로그인. 관리자 여부는 백엔드가 강제(비관리자는 이후 화면 403). */
export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await login(email.trim(), password);
            router.replace("/announcements");
        } catch (err) {
            const msg = err instanceof ApiError ? "이메일 또는 비밀번호를 확인해주세요." : "로그인에 실패했습니다.";
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center px-4">
            <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="mb-1 text-lg font-bold text-slate-900">소설비 운영 툴</h1>
                <p className="mb-5 text-sm text-slate-500">관리자 계정으로 로그인하세요.</p>

                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">이메일</label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                    className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />

                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">비밀번호</label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />

                {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                    {submitting ? "로그인 중…" : "로그인"}
                </button>
            </form>
        </div>
    );
}
