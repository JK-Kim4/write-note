"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/lib/auth/guard";
import { fetchMe, logout } from "@/lib/api/auth";
import { TopBar } from "@/components/shell/TopBar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { usePreferences, type ManuscriptSize, type WritingMode } from "@/stores/preferences";

/**
 * Settings page — DESIGN.md §7 분리 원칙 의 환경 preferences.
 *
 * Spec reference: contracts/route-surfaces.md §2-4
 * 작성 모드 / 원고지 크기 / 테마 → preferences store 갱신
 * 계정 영역: 쿠키 세션(`/me`) 본인 정보 표시 + 로그아웃
 */

export default function SettingsPage() {
    useAuthGuard("requireAuth");
    const router = useRouter();
    const queryClient = useQueryClient();
    const { writingMode, setWritingMode, manuscriptSize, setManuscriptSize } = usePreferences();
    const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe, retry: false });
    const logoutMutation = useMutation({
        mutationFn: logout,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
            router.replace("/auth/login");
        },
    });

    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--w-parchment)" }}>
            <TopBar title="설정" actions={<ThemeToggle />} />
            <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 flex flex-col gap-10">
                <SettingsGroup title="작성">
                    <Field label="작성 모드">
                        <div className="flex gap-3">
                            {(["manuscript", "editor"] as WritingMode[]).map((mode) => (
                                <ModeCard
                                    key={mode}
                                    active={writingMode === mode}
                                    label={mode === "manuscript" ? "원고지" : "에디터"}
                                    desc={
                                        mode === "manuscript"
                                            ? "200·400·1000 자 격자 입력"
                                            : "Word 스타일 풀 툴바"
                                    }
                                    onClick={() => setWritingMode(mode)}
                                />
                            ))}
                        </div>
                    </Field>
                    <Field label="원고지 크기">
                        <div className="flex gap-2">
                            {([200, 400, 1000] as ManuscriptSize[]).map((size) => (
                                <PillButton
                                    key={size}
                                    active={manuscriptSize === size}
                                    onClick={() => setManuscriptSize(size)}
                                >
                                    {size} 자
                                </PillButton>
                            ))}
                        </div>
                    </Field>
                </SettingsGroup>

                <SettingsGroup title="일반">
                    <Field label="테마">
                        <ThemeToggle />
                    </Field>
                </SettingsGroup>

                <SettingsGroup title="계정">
                    <Field label="이메일">
                        <code
                            style={{
                                fontFamily: "var(--w-font-ui)",
                                fontSize: "13px",
                                backgroundColor: "var(--w-parchment)",
                                padding: "4px 8px",
                                borderRadius: "var(--w-radius-button-utility)",
                                color: "var(--w-ink)",
                            }}
                        >
                            {meQuery.data?.email ?? "—"}
                        </code>
                    </Field>
                    <Field label="로그아웃">
                        <PillButton
                            onClick={() => logoutMutation.mutate()}
                        >
                            로그아웃
                        </PillButton>
                    </Field>
                </SettingsGroup>
            </main>
        </div>
    );
}

function SettingsGroup({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="flex flex-col gap-4">
            <h2
                className="font-display font-semibold"
                style={{ fontSize: "20px", color: "var(--w-ink)" }}
            >
                {title}
            </h2>
            <div className="flex flex-col gap-4">{children}</div>
        </section>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span style={{ color: "var(--w-ink)", opacity: 0.7, fontSize: "14px" }}>
                {label}
            </span>
            <div>{children}</div>
        </div>
    );
}

function ModeCard({
    active,
    label,
    desc,
    onClick,
}: {
    active: boolean;
    label: string;
    desc: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex flex-col items-start gap-1 p-4 rounded-card-mode min-w-[180px]"
            style={{
                backgroundColor: active ? "color-mix(in srgb, var(--w-accent) 6%, transparent)" : "var(--w-canvas)",
                border: active ? "1px solid var(--w-accent)" : "1px solid var(--w-hairline)",
                color: "var(--w-ink)",
            }}
        >
            <span className="font-semibold" style={{ fontSize: "15px" }}>
                {label}
            </span>
            <span style={{ fontSize: "13px", opacity: 0.7 }}>{desc}</span>
        </button>
    );
}

function PillButton({
    children,
    active = false,
    onClick,
}: {
    children: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="px-3 py-1.5 rounded-button-pill text-sm font-semibold"
            style={{
                backgroundColor: active ? "var(--w-ink)" : "var(--w-canvas)",
                color: active ? "var(--w-canvas)" : "var(--w-ink)",
                border: "1px solid var(--w-hairline)",
            }}
        >
            {children}
        </button>
    );
}
