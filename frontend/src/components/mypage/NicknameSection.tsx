"use client";

import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setNickname } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";

/**
 * 마이페이지 닉네임 표시·변경 (036 US2).
 *
 * 변경 성공 시 `["auth","me"]` 무효화로 전역 닉네임을 갱신한다.
 * 에러는 백엔드 `error.code`(client.ts 가 ApiError.code 로 전달) 기준으로 인라인 메시지를 고른다.
 */
const ERROR_MESSAGES: Record<string, string> = {
    NICKNAME_INVALID_FORMAT: "2~16자의 한글·영문·숫자·밑줄만 사용할 수 있어요.",
    NICKNAME_FORBIDDEN_WORD: "사용할 수 없는 단어가 포함되어 있어요.",
    NICKNAME_ALREADY_REGISTERED: "이미 사용 중인 닉네임이에요.",
};

export function NicknameSection({ currentNickname }: { currentNickname: string }) {
    const [value, setValue] = useState(currentNickname);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (nickname: string) => setNickname(nickname),
        onSuccess: async () => {
            setError(null);
            setSaved(true);
            await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        },
        onError: (e: unknown) => {
            setSaved(false);
            const code = e instanceof ApiError ? e.code : "";
            setError(ERROR_MESSAGES[code] ?? "닉네임을 변경하지 못했어요. 잠시 후 다시 시도해 주세요.");
        },
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setSaved(false);
        setError(null);
        mutation.mutate(value.trim());
    };

    return (
        <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-ink">닉네임</h2>
            <p className="mt-0.5 text-xs text-faint">
                다른 작가에게 보이는 이름입니다. 2~16자의 한글·영문·숫자·밑줄을 쓸 수 있어요.
            </p>
            <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="flex-1">
                    <label htmlFor="nickname-input" className="sr-only">
                        닉네임
                    </label>
                    <input
                        id="nickname-input"
                        type="text"
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value);
                            setSaved(false);
                            setError(null);
                        }}
                        maxLength={16}
                        className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink outline-none focus:border-terracotta-400"
                    />
                    {error ? (
                        <p role="alert" className="mt-1 text-xs text-red-500">
                            {error}
                        </p>
                    ) : saved ? (
                        <p role="status" className="mt-1 text-xs text-teal-600">
                            닉네임을 변경했어요.
                        </p>
                    ) : null}
                </div>
                <button
                    type="submit"
                    disabled={mutation.isPending || value.trim().length === 0}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-terracotta-700 disabled:opacity-50"
                >
                    {mutation.isPending ? "저장 중…" : "변경"}
                </button>
            </form>
        </section>
    );
}
