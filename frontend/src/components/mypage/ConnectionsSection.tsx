"use client";

import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { linkEmailPassword, startKakaoLink } from "@/lib/api/users";

/**
 * 계정 연결 섹션 (037 US3) — 로그인 수단(이메일/비밀번호·카카오) 연결 상태 + 미연결 수단 연결.
 * 해제는 백엔드 미지원이라 제공하지 않는다(FR-010).
 */
const PASSWORD_ERROR_MESSAGES: Record<string, string> = {
    PASSWORD_ALREADY_SET: "이미 비밀번호가 설정되어 있어요.",
    PASSWORD_TOO_WEAK: "비밀번호는 8자 이상, 영문·숫자를 포함해야 해요.",
};

export function ConnectionsSection({ kakaoLinked, passwordSet }: { kakaoLinked: boolean; passwordSet: boolean }) {
    const queryClient = useQueryClient();
    const [password, setPassword] = useState("");
    const [pwError, setPwError] = useState<string | null>(null);
    const [pwSaved, setPwSaved] = useState(false);

    const linkPasswordMutation = useMutation({
        mutationFn: (pw: string) => linkEmailPassword(pw),
        onSuccess: async () => {
            setPwError(null);
            setPwSaved(true);
            setPassword("");
            await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        },
        onError: (e: unknown) => {
            setPwSaved(false);
            const code = e instanceof ApiError ? e.code : "";
            setPwError(PASSWORD_ERROR_MESSAGES[code] ?? "비밀번호를 설정하지 못했어요. 잠시 후 다시 시도해 주세요.");
        },
    });

    const handlePasswordSubmit = (e: FormEvent) => {
        e.preventDefault();
        setPwSaved(false);
        setPwError(null);
        linkPasswordMutation.mutate(password);
    };

    return (
        <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-ink">계정 연결</h2>
            <p className="mt-0.5 text-xs text-faint">로그인 수단을 추가로 연결할 수 있어요. 연결 해제는 지원하지 않습니다.</p>

            <dl className="mt-4 space-y-4">
                {/* 이메일 / 비밀번호 */}
                <div className="flex flex-col gap-2 border-b border-border pb-4">
                    <div className="flex items-center justify-between">
                        <dt className="text-sm font-medium text-ink-2">이메일 · 비밀번호</dt>
                        <dd className={passwordSet ? "text-sm text-teal-600" : "text-sm text-faint"}>
                            {passwordSet ? "연결됨" : "미설정"}
                        </dd>
                    </div>
                    {!passwordSet ? (
                        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                            <div className="flex-1">
                                <label htmlFor="link-password" className="sr-only">
                                    추가할 비밀번호
                                </label>
                                <input
                                    id="link-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setPwSaved(false);
                                        setPwError(null);
                                    }}
                                    placeholder="비밀번호 추가 등록 (8자 이상)"
                                    className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink outline-none focus:border-terracotta-400"
                                />
                                {pwError ? (
                                    <p role="alert" className="mt-1 text-xs text-red-500">
                                        {pwError}
                                    </p>
                                ) : pwSaved ? (
                                    <p role="status" className="mt-1 text-xs text-teal-600">
                                        비밀번호를 설정했어요.
                                    </p>
                                ) : null}
                            </div>
                            <button
                                type="submit"
                                disabled={linkPasswordMutation.isPending || password.length === 0}
                                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-terracotta-700 disabled:opacity-50"
                            >
                                {linkPasswordMutation.isPending ? "설정 중…" : "등록"}
                            </button>
                        </form>
                    ) : null}
                </div>

                {/* 카카오 */}
                <div className="flex items-center justify-between">
                    <dt className="text-sm font-medium text-ink-2">카카오</dt>
                    <dd>
                        {kakaoLinked ? (
                            <span className="text-sm text-teal-600">연결됨</span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => void startKakaoLink()}
                                className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2"
                            >
                                카카오 연결
                            </button>
                        )}
                    </dd>
                </div>
            </dl>
        </section>
    );
}
