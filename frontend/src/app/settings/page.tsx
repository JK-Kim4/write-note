"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuthGuard } from "@/lib/auth/guard";
import { fetchMe, logout } from "@/lib/api/auth";
import { TopBar } from "@/components/shell/TopBar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { usePreferences, type ManuscriptSize, type WritingMode } from "@/stores/preferences";
import {
    useApiTokens,
    useIssueToken,
    useRevokeToken,
    useUpdateTokenLabel,
} from "@/lib/api/apiToken";
import type { ApiTokenIssueResponse, ApiTokenListItem } from "@/types/api";

/**
 * Settings page — DESIGN.md §7 분리 원칙 의 환경 preferences.
 *
 * Spec reference: contracts/route-surfaces.md §2-4
 * 작성 모드 / 원고지 크기 / 테마 → preferences store 갱신
 * 계정 영역: 쿠키 세션(`/me`) 본인 정보 표시 + 로그아웃
 * 모바일 캡처 토큰 영역: 006 US5 — 발급 / 목록 / 해지 + iOS Shortcut 안내
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

    // 토큰 발급 후 1회 표시용 state — 모달에 원본 token 전달
    const [issuedToken, setIssuedToken] = useState<ApiTokenIssueResponse | null>(null);

    const tokensQuery = useApiTokens();
    const issueMutation = useIssueToken();

    const handleIssueToken = () => {
        issueMutation.mutate(
            { label: undefined },
            { onSuccess: (data) => setIssuedToken(data) },
        );
    };

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

                {/* ── 모바일 캡처 토큰 (006 US5) ── */}
                <SettingsGroup title="모바일 캡처 토큰">
                    <div className="flex flex-col gap-4">
                        <p style={{ fontSize: "14px", color: "var(--w-ink)", opacity: 0.7, lineHeight: 1.6 }}>
                            iOS Shortcut 등 외부 앱에서 메모를 전송할 때 사용하는 장기 토큰입니다.
                            토큰은 발급 직후 1회만 표시되며, 이후에는 앞 6자리(prefix)만 확인 가능합니다.
                        </p>

                        <PillButton
                            onClick={handleIssueToken}
                        >
                            {issueMutation.isPending ? "발급 중…" : "새 토큰 발급"}
                        </PillButton>

                        {issueMutation.isError ? (
                            <p style={{ fontSize: "13px", color: "var(--w-error)" }}>
                                발급 실패. 다시 시도해 주세요.
                            </p>
                        ) : null}

                        {tokensQuery.data && tokensQuery.data.length > 0 ? (
                            <TokenList tokens={tokensQuery.data} />
                        ) : null}

                        {tokensQuery.data && tokensQuery.data.length === 0 ? (
                            <p style={{ fontSize: "13px", color: "var(--w-ink)", opacity: 0.5 }}>
                                발급된 토큰이 없습니다.
                            </p>
                        ) : null}
                    </div>
                </SettingsGroup>

                {/* ── iOS Shortcut 셋업 안내 (006 US5 / quickstart §5) ── */}
                <SettingsGroup title="iOS Shortcut 설정 안내">
                    <div
                        className="flex flex-col gap-3 rounded-card-memo p-4"
                        style={{
                            backgroundColor: "var(--w-canvas)",
                            border: "1px solid var(--w-hairline)",
                            fontSize: "14px",
                            color: "var(--w-ink)",
                            lineHeight: 1.7,
                        }}
                    >
                        <p>
                            iPhone 의 <b>단축어(Shortcuts)</b> 앱에서 아래와 같이 설정하면 공유 시트에서 바로 메모를 전송할 수 있습니다.
                        </p>
                        <ol className="flex flex-col gap-2" style={{ paddingLeft: "1.2em", listStyle: "decimal" }}>
                            <li>단축어 앱 → 새 단축어 → <b>URL 콘텐츠 가져오기</b> 동작 추가</li>
                            <li>
                                URL:{" "}
                                <code
                                    style={{
                                        fontFamily: "var(--w-font-ui)",
                                        fontSize: "12px",
                                        backgroundColor: "var(--w-parchment)",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                    }}
                                >
                                    https://&lt;백엔드 주소&gt;/api/capture
                                </code>
                            </li>
                            <li>메서드: <b>POST</b></li>
                            <li>
                                헤더 추가:
                                <code
                                    style={{
                                        display: "block",
                                        fontFamily: "var(--w-font-ui)",
                                        fontSize: "12px",
                                        backgroundColor: "var(--w-parchment)",
                                        padding: "6px 10px",
                                        borderRadius: "4px",
                                        marginTop: "4px",
                                    }}
                                >
                                    Authorization: Bearer wnt_...발급받은_토큰...
                                </code>
                            </li>
                            <li>
                                본문(JSON):
                                <code
                                    style={{
                                        display: "block",
                                        fontFamily: "var(--w-font-ui)",
                                        fontSize: "12px",
                                        backgroundColor: "var(--w-parchment)",
                                        padding: "6px 10px",
                                        borderRadius: "4px",
                                        marginTop: "4px",
                                    }}
                                >
                                    {`{"body": "<단축어에서 선택한 텍스트>"}`}
                                </code>
                            </li>
                            <li>단축어를 공유 시트에 표시 → <b>공유 시트에 표시</b> 활성화</li>
                        </ol>
                        <p style={{ opacity: 0.6, fontSize: "13px" }}>
                            토큰을 분실하면 위 토큰 목록에서 해지하고 새로 발급하세요.
                        </p>
                    </div>
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
                    <Field label="카카오 연결">
                        {meQuery.data?.kakaoLinked ? (
                            <span style={{ color: "var(--w-ink)", opacity: 0.7, fontSize: "14px" }}>연결됨</span>
                        ) : (
                            <form action="/api/auth/link/kakao" method="post">
                                <button
                                    type="submit"
                                    className="px-3 py-1.5 rounded-button-pill text-sm font-semibold"
                                    style={{
                                        backgroundColor: "var(--w-canvas)",
                                        color: "var(--w-ink)",
                                        border: "1px solid var(--w-hairline)",
                                    }}
                                >
                                    카카오 연결
                                </button>
                            </form>
                        )}
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

            {/* 발급 모달 — 원본 토큰 1회 표시 */}
            {issuedToken !== null ? (
                <IssuedTokenModal
                    issued={issuedToken}
                    onClose={() => setIssuedToken(null)}
                />
            ) : null}
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

// ─── 발급 모달 (원본 토큰 1회 표시) ────────────────────────────────────────────

function IssuedTokenModal({
    issued,
    onClose,
}: {
    issued: ApiTokenIssueResponse;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        void navigator.clipboard.writeText(issued.token).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="새 토큰 발급 완료"
            className="fixed inset-0 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 50 }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="flex flex-col gap-5 rounded-card-memo p-6 max-w-md w-full mx-4"
                style={{
                    backgroundColor: "var(--w-canvas)",
                    border: "1px solid var(--w-hairline)",
                }}
            >
                <h3
                    className="font-display font-semibold"
                    style={{ fontSize: "18px", color: "var(--w-ink)" }}
                >
                    토큰 발급 완료
                </h3>

                {/* 경고 배너 */}
                <div
                    className="flex items-start gap-2 rounded-card-memo p-3"
                    style={{
                        backgroundColor: "color-mix(in srgb, var(--w-error) 6%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--w-error) 20%, transparent)",
                    }}
                >
                    <span style={{ color: "var(--w-error)", fontSize: "16px" }}>⚠</span>
                    <p style={{ fontSize: "13px", color: "var(--w-error)", lineHeight: 1.6 }}>
                        이 토큰은 지금만 확인할 수 있습니다. 창을 닫으면 다시 볼 수 없습니다.
                    </p>
                </div>

                {/* 토큰 표시 + 복사 */}
                <div className="flex flex-col gap-2">
                    <p style={{ fontSize: "13px", color: "var(--w-ink)", opacity: 0.7 }}>
                        {issued.label ? `라벨: ${issued.label} · ` : ""}앞 6자리: {issued.tokenPrefix}
                    </p>
                    <div
                        className="flex items-center gap-2 rounded-button-utility px-3 py-2"
                        style={{
                            backgroundColor: "var(--w-parchment)",
                            border: "1px solid var(--w-hairline)",
                        }}
                    >
                        <code
                            className="flex-1 break-all"
                            style={{
                                fontFamily: "var(--w-font-ui)",
                                fontSize: "12px",
                                color: "var(--w-ink)",
                                wordBreak: "break-all",
                            }}
                        >
                            {issued.token}
                        </code>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="px-2 py-1 rounded-button-pill text-xs font-semibold shrink-0"
                            style={{
                                backgroundColor: copied ? "var(--w-accent)" : "var(--w-canvas)",
                                color: copied ? "var(--w-canvas)" : "var(--w-ink)",
                                border: "1px solid var(--w-hairline)",
                                transition: "background-color 0.15s",
                            }}
                        >
                            {copied ? "복사됨" : "복사"}
                        </button>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="self-end px-4 py-2 rounded-button-pill text-sm font-semibold"
                    style={{
                        backgroundColor: "var(--w-ink)",
                        color: "var(--w-canvas)",
                    }}
                >
                    확인 (닫기)
                </button>
            </div>
        </div>
    );
}

// ─── 토큰 목록 ────────────────────────────────────────────────────────────────

function TokenList({ tokens }: { tokens: ApiTokenListItem[] }) {
    return (
        <div className="flex flex-col gap-2">
            {tokens.map((token) => (
                <TokenRow key={token.id} token={token} />
            ))}
        </div>
    );
}

function TokenRow({ token }: { token: ApiTokenListItem }) {
    const [editingLabel, setEditingLabel] = useState(false);
    const [labelInput, setLabelInput] = useState(token.label ?? "");
    const updateMutation = useUpdateTokenLabel();
    const revokeMutation = useRevokeToken();
    const isRevoked = token.revokedAt !== null;

    const handleSaveLabel = () => {
        updateMutation.mutate(
            { id: token.id, input: { label: labelInput } },
            { onSuccess: () => setEditingLabel(false) },
        );
    };

    const handleRevoke = () => {
        if (!confirm(`토큰 "${token.tokenPrefix}…" 을 해지하시겠습니까? 해지된 토큰은 복구할 수 없습니다.`)) return;
        revokeMutation.mutate(token.id);
    };

    return (
        <div
            className="flex flex-col gap-2 rounded-card-memo p-3"
            style={{
                backgroundColor: isRevoked
                    ? "color-mix(in srgb, var(--w-ink) 4%, transparent)"
                    : "var(--w-canvas)",
                border: "1px solid var(--w-hairline)",
                opacity: isRevoked ? 0.6 : 1,
            }}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <code
                        style={{
                            fontFamily: "var(--w-font-ui)",
                            fontSize: "12px",
                            color: "var(--w-ink)",
                            opacity: 0.7,
                        }}
                    >
                        {token.tokenPrefix}…
                    </code>
                    {isRevoked ? (
                        <span
                            className="px-1.5 py-0.5 rounded text-xs font-semibold"
                            style={{
                                backgroundColor: "color-mix(in srgb, var(--w-error) 10%, transparent)",
                                color: "var(--w-error)",
                                fontSize: "11px",
                            }}
                        >
                            해지됨
                        </span>
                    ) : null}
                </div>

                {!isRevoked ? (
                    <button
                        type="button"
                        onClick={handleRevoke}
                        disabled={revokeMutation.isPending}
                        className="px-2 py-1 rounded-button-pill text-xs font-semibold shrink-0"
                        style={{
                            backgroundColor: "color-mix(in srgb, var(--w-error) 8%, transparent)",
                            color: "var(--w-error)",
                            border: "1px solid color-mix(in srgb, var(--w-error) 20%, transparent)",
                        }}
                    >
                        {revokeMutation.isPending ? "해지 중…" : "해지"}
                    </button>
                ) : null}
            </div>

            {/* label 편집 */}
            {!isRevoked && (
                <div className="flex items-center gap-2">
                    {editingLabel ? (
                        <>
                            <input
                                type="text"
                                value={labelInput}
                                onChange={(e) => setLabelInput(e.target.value)}
                                className="flex-1 px-2 py-1 rounded-button-utility text-sm outline-none"
                                style={{
                                    backgroundColor: "var(--w-parchment)",
                                    color: "var(--w-ink)",
                                    border: "1px solid var(--w-hairline)",
                                    fontSize: "13px",
                                }}
                                placeholder="라벨 입력"
                            />
                            <button
                                type="button"
                                onClick={handleSaveLabel}
                                disabled={updateMutation.isPending}
                                className="px-2 py-1 rounded-button-pill text-xs font-semibold"
                                style={{
                                    backgroundColor: "var(--w-ink)",
                                    color: "var(--w-canvas)",
                                }}
                            >
                                {updateMutation.isPending ? "저장 중…" : "저장"}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setLabelInput(token.label ?? "");
                                    setEditingLabel(false);
                                }}
                                className="px-2 py-1 rounded-button-pill text-xs font-semibold"
                                style={{
                                    backgroundColor: "var(--w-canvas)",
                                    color: "var(--w-ink)",
                                    border: "1px solid var(--w-hairline)",
                                }}
                            >
                                취소
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setEditingLabel(true)}
                            className="text-xs"
                            style={{ color: "var(--w-ink)", opacity: 0.6 }}
                        >
                            {token.label ? token.label : "라벨 없음"} · 수정
                        </button>
                    )}
                </div>
            )}

            {/* 마지막 사용 / 생성일 */}
            <div style={{ fontSize: "12px", color: "var(--w-ink)", opacity: 0.5 }}>
                {token.lastUsedAt !== null
                    ? `마지막 사용: ${new Date(token.lastUsedAt).toLocaleDateString("ko-KR")}`
                    : "아직 사용 안 함"}{" "}
                · 생성: {new Date(token.createdAt).toLocaleDateString("ko-KR")}
                {isRevoked && token.revokedAt !== null
                    ? ` · 해지: ${new Date(token.revokedAt).toLocaleDateString("ko-KR")}`
                    : null}
            </div>
        </div>
    );
}
