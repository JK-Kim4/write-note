"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { withdraw, WITHDRAWAL_CONFIRMATION_PHRASE } from "@/lib/api/auth";

/**
 * 회원 탈퇴 섹션 (037) — 기존 설정 화면의 탈퇴 모달을 위치만 이동(동작 보존, FR-012).
 * 확인 문구 입력 모달로 우발 탈퇴를 막는다.
 */
export function WithdrawSection() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [withdrawOpen, setWithdrawOpen] = useState(false);
    const [confirmInput, setConfirmInput] = useState("");
    const [withdrawing, setWithdrawing] = useState(false);
    const [withdrawError, setWithdrawError] = useState(false);

    const handleWithdraw = async () => {
        setWithdrawing(true);
        setWithdrawError(false);
        try {
            await withdraw(confirmInput);
            queryClient.clear();
            router.replace("/welcome");
        } catch {
            setWithdrawError(true);
            setWithdrawing(false);
        }
    };

    return (
        <section className="rounded-xl border border-red-200 bg-white p-5">
            <h2 className="text-base font-semibold text-red-600">회원 탈퇴</h2>
            <p className="mt-0.5 text-xs text-gray-400">탈퇴하면 모든 작품·메모·설정이 영구 삭제되며 되돌릴 수 없습니다.</p>
            <button
                type="button"
                onClick={() => setWithdrawOpen(true)}
                className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
            >
                회원 탈퇴
            </button>

            {withdrawOpen ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="회원 탈퇴 확인"
                    className="fixed inset-0 flex items-center justify-center"
                    style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 50 }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !withdrawing) setWithdrawOpen(false);
                    }}
                >
                    <div className="mx-4 flex w-full max-w-md flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
                        <h3 className="text-lg font-semibold text-red-600">정말 탈퇴하시겠어요?</h3>
                        <p className="text-sm text-gray-600" style={{ lineHeight: 1.6 }}>
                            모든 작품·메모·설정이 영구 삭제되며 되돌릴 수 없습니다. 아래에{" "}
                            <strong>{WITHDRAWAL_CONFIRMATION_PHRASE}</strong> 를 입력하면 탈퇴됩니다.
                        </p>
                        <label htmlFor="withdraw-confirm" className="sr-only">
                            확인 문구
                        </label>
                        <input
                            id="withdraw-confirm"
                            type="text"
                            value={confirmInput}
                            onChange={(e) => setConfirmInput(e.target.value)}
                            placeholder={WITHDRAWAL_CONFIRMATION_PHRASE}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-400"
                        />
                        {withdrawError ? (
                            <p role="alert" className="text-xs text-red-500">
                                탈퇴에 실패했습니다. 다시 시도해 주세요.
                            </p>
                        ) : null}
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setWithdrawOpen(false)}
                                disabled={withdrawing}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleWithdraw()}
                                disabled={confirmInput !== WITHDRAWAL_CONFIRMATION_PHRASE || withdrawing}
                                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {withdrawing ? "탈퇴 중…" : "탈퇴하기"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
