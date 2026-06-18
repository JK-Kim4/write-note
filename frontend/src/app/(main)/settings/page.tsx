"use client";

import { type KeyboardEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "@/lib/api/auth";
import {
    usePreferences,
    useIsPreferencesHydrated,
    type PaperSize,
    type ThemeMode,
} from "@/stores/preferences";
import {
    useApiTokens,
    useIssueToken,
    useUpdateTokenLabel,
    useRevokeToken,
} from "@/lib/api/apiToken";
import type { ApiTokenIssueResponse, ApiTokenListItem } from "@/types/api";

/**
 * B타입 설정 — fable-test 카드 문법으로 구성한 설정 화면.
 * 테마는 기존 preferences 스토어(A 디자인과 공유) 그대로 — B 화면 자체는 라이트 고정이고
 * 테마 값은 기존(A) 디자인 화면에 적용된다. 계정 정보는 ["auth","me"] 쿼리 재사용.
 */

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
    { value: "light", label: "라이트", description: "항상 밝은 화면" },
    { value: "dark", label: "다크", description: "항상 어두운 화면" },
    { value: "system", label: "시스템", description: "기기 설정을 따름" },
];

const PAPER_SIZE_OPTIONS: { value: PaperSize; label: string; description: string }[] = [
    { value: "A4", label: "A4", description: "210×297mm — 일반 원고지 (기본)" },
    { value: "A3", label: "A3", description: "297×420mm — 넓은 원고지" },
    { value: "A2", label: "A2", description: "420×594mm — 대형 원고지" },
    { value: "B4", label: "B4", description: "257×364mm — JIS B4 규격" },
];

/**
 * radiogroup 화살표키 이동(roving tabindex 짝). ArrowDown/Right → 다음, ArrowUp/Left → 이전(순환).
 * 이동과 동시에 선택값을 바꾸고 새 항목 버튼에 focus 를 옮긴다. options 는 value 순서대로 렌더된다는 전제.
 */
function handleRadioKeyDown<TValue extends string>(
    e: KeyboardEvent<HTMLButtonElement>,
    options: readonly { value: TValue }[],
    current: TValue,
    onSelect: (value: TValue) => void,
): void {
    const isNext = e.key === "ArrowDown" || e.key === "ArrowRight";
    const isPrev = e.key === "ArrowUp" || e.key === "ArrowLeft";
    if (!isNext && !isPrev) return;
    e.preventDefault();
    const currentIndex = options.findIndex((o) => o.value === current);
    const base = currentIndex === -1 ? 0 : currentIndex;
    const delta = isNext ? 1 : -1;
    const nextIndex = (base + delta + options.length) % options.length;
    const nextValue = options[nextIndex].value;
    onSelect(nextValue);
    const group = e.currentTarget.parentElement;
    const buttons = group?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
    buttons?.[nextIndex]?.focus();
}

export default function BSettingsPage() {
    const { theme, setTheme, paperSize, setPaperSize } = usePreferences();
    // 미수화(하드 로드 직후) 동안에는 선택 강조를 보류 — 기본값(A4/시스템)으로 깜빡였다 교정되는 현상 방지.
    const isHydrated = useIsPreferencesHydrated();
    const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe, retry: false });

    // 토큰 관리
    const tokensQuery = useApiTokens();
    const issueMutation = useIssueToken();
    const [issuedToken, setIssuedToken] = useState<ApiTokenIssueResponse | null>(null);
    const [newTokenLabel, setNewTokenLabel] = useState("");

    const handleIssueToken = () => {
        issueMutation.mutate(
            { label: newTokenLabel.trim() || undefined },
            {
                onSuccess: (data) => {
                    setIssuedToken(data);
                    setNewTokenLabel("");
                },
            },
        );
    };

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="mb-6 text-xl font-bold">설정</h1>

            <section className="mb-4 rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">새 작품 기본 용지</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                    새 작품을 만들 때 기본으로 쓸 용지입니다. 작품별 용지는 집필실 좌측 &ldquo;용지&rdquo;에서 바꿀 수 있어요.
                </p>
                <div role="radiogroup" aria-label="새 작품 기본 용지" aria-busy={!isHydrated} className="mt-3 grid grid-cols-2 gap-2">
                    {PAPER_SIZE_OPTIONS.map((option) => {
                        const selected = isHydrated && paperSize === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                tabIndex={!isHydrated ? -1 : paperSize === option.value ? 0 : -1}
                                disabled={!isHydrated}
                                onClick={() => setPaperSize(option.value)}
                                onKeyDown={(e) => handleRadioKeyDown(e, PAPER_SIZE_OPTIONS, paperSize, setPaperSize)}
                                className={
                                    selected
                                        ? "rounded-md border border-terracotta-500 bg-terracotta-50 px-3 py-2.5 text-left"
                                        : "rounded-md border border-gray-300 px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-60 disabled:hover:bg-transparent"
                                }
                            >
                                <span
                                    className={
                                        selected
                                            ? "block text-sm font-medium text-terracotta-700"
                                            : "block text-sm font-medium text-gray-700"
                                    }
                                >
                                    {option.label}
                                </span>
                                <span className="mt-0.5 block text-xs text-gray-400">{option.description}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">테마</h2>
                <p className="mt-0.5 text-xs text-gray-400">기존 디자인 화면에 적용됩니다. B 디자인은 라이트 고정.</p>
                <div role="radiogroup" aria-label="테마" aria-busy={!isHydrated} className="mt-3 grid grid-cols-3 gap-2">
                    {THEME_OPTIONS.map((option) => {
                        const selected = isHydrated && theme === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                tabIndex={!isHydrated ? -1 : theme === option.value ? 0 : -1}
                                disabled={!isHydrated}
                                onClick={() => setTheme(option.value)}
                                onKeyDown={(e) => handleRadioKeyDown(e, THEME_OPTIONS, theme, setTheme)}
                                className={
                                    selected
                                        ? "rounded-md border border-terracotta-500 bg-terracotta-50 px-3 py-2.5 text-left"
                                        : "rounded-md border border-gray-300 px-3 py-2.5 text-left hover:bg-gray-50 disabled:opacity-60 disabled:hover:bg-transparent"
                                }
                            >
                                <span
                                    className={
                                        selected
                                            ? "block text-sm font-medium text-terracotta-700"
                                            : "block text-sm font-medium text-gray-700"
                                    }
                                >
                                    {option.label}
                                </span>
                                <span className="mt-0.5 block text-xs text-gray-400">{option.description}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">계정</h2>
                {meQuery.isPending ? (
                    <p className="mt-3 text-sm text-gray-400">불러오는 중…</p>
                ) : meQuery.data ? (
                    <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-500">이메일</dt>
                            <dd className="text-gray-900">{meQuery.data.email}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">카카오 연결</dt>
                            <dd className="text-gray-900">{meQuery.data.kakaoLinked ? "연결됨" : "미연결"}</dd>
                        </div>
                    </dl>
                ) : (
                    <div className="mt-3">
                        <p className="text-sm text-gray-500">계정 정보를 불러올 수 없습니다.</p>
                        <button
                            type="button"
                            onClick={() => meQuery.refetch()}
                            disabled={meQuery.isFetching}
                            className="mt-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                            다시 시도
                        </button>
                    </div>
                )}
            </section>

            {/* ── 모바일 캡처 토큰 ── */}
            <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">모바일 캡처 토큰</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                    iOS Shortcut 등 외부 앱에서 메모를 전송할 때 사용하는 장기 토큰입니다.
                    토큰은 발급 직후 1회만 표시되며, 이후에는 앞 6자리(prefix)만 확인 가능합니다.
                </p>

                {/* 새 토큰 발급 */}
                <div className="mt-4 flex gap-2">
                    <label htmlFor="new-token-label" className="sr-only">새 토큰 라벨</label>
                    <input
                        id="new-token-label"
                        type="text"
                        value={newTokenLabel}
                        onChange={(e) => setNewTokenLabel(e.target.value)}
                        placeholder="라벨 (선택)"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-terracotta-400 focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                    />
                    <button
                        type="button"
                        onClick={handleIssueToken}
                        disabled={issueMutation.isPending}
                        className="rounded-md border border-terracotta-500 bg-terracotta-50 px-3 py-1.5 text-sm font-medium text-terracotta-700 hover:bg-terracotta-100 disabled:opacity-50"
                    >
                        {issueMutation.isPending ? "발급 중…" : "새 토큰 발급"}
                    </button>
                </div>
                {issueMutation.isError ? (
                    <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                        <span aria-hidden="true">⚠</span>
                        발급 실패. 다시 시도해 주세요.
                    </p>
                ) : null}

                {/* 토큰 목록 */}
                <div className="mt-4 flex flex-col gap-2">
                    {tokensQuery.isPending ? (
                        <p className="text-sm text-gray-400">불러오는 중…</p>
                    ) : tokensQuery.data && tokensQuery.data.length > 0 ? (
                        tokensQuery.data.map((token) => (
                            <TokenRow key={token.id} token={token} />
                        ))
                    ) : (
                        <p className="text-sm text-gray-400">발급된 토큰이 없습니다.</p>
                    )}
                </div>
            </section>

            {/* ── iOS Shortcut 설정 안내 ── */}
            <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">iOS Shortcut 설정 안내</h2>
                <div className="mt-3 flex flex-col gap-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-700" style={{ lineHeight: 1.7 }}>
                    <p>
                        iPhone의 <strong>단축어(Shortcuts)</strong> 앱에서 아래와 같이 설정하면 공유 시트에서 바로 메모를 전송할 수 있습니다.
                    </p>
                    <ol className="flex flex-col gap-2" style={{ paddingLeft: "1.2em", listStyle: "decimal" }}>
                        <li>단축어 앱 → 새 단축어 → <strong>URL 콘텐츠 가져오기</strong> 동작 추가</li>
                        <li>
                            URL:{" "}
                            <code className="rounded bg-white px-1.5 py-0.5 text-xs font-mono border border-gray-200">
                                https://&lt;백엔드 주소&gt;/api/capture
                            </code>
                        </li>
                        <li>메서드: <strong>POST</strong></li>
                        <li>
                            헤더 추가:
                            <code className="mt-1 block rounded bg-white px-2.5 py-1.5 text-xs font-mono border border-gray-200">
                                Authorization: Bearer wnt_...발급받은_토큰...
                            </code>
                        </li>
                        <li>
                            본문(JSON):
                            <code className="mt-1 block rounded bg-white px-2.5 py-1.5 text-xs font-mono border border-gray-200">
                                {`{"body": "<단축어에서 선택한 텍스트>"}`}
                            </code>
                        </li>
                        <li>단축어를 공유 시트에 표시 → <strong>공유 시트에 표시</strong> 활성화</li>
                    </ol>
                    <p className="text-xs text-gray-400">
                        토큰을 분실하면 위 토큰 목록에서 해지하고 새로 발급하세요.
                    </p>
                </div>
            </section>

            {/* 발급 모달 — 원본 토큰 1회 표시 */}
            {issuedToken !== null ? (
                <IssuedTokenModal issued={issuedToken} onClose={() => setIssuedToken(null)} />
            ) : null}
        </div>
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
            <div className="mx-4 flex w-full max-w-md flex-col gap-5 rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900">토큰 발급 완료</h3>

                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <span className="text-red-500">⚠</span>
                    <p className="text-sm text-red-600" style={{ lineHeight: 1.6 }}>
                        이 토큰은 지금만 확인할 수 있습니다. 창을 닫으면 다시 볼 수 없습니다.
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    <p className="text-xs text-gray-400">
                        {issued.label ? `라벨: ${issued.label} · ` : ""}앞 6자리: {issued.tokenPrefix}
                    </p>
                    <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                        <code className="flex-1 break-all text-xs font-mono text-gray-800">
                            {issued.token}
                        </code>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={
                                copied
                                    ? "shrink-0 rounded-md border border-terracotta-600 bg-terracotta-600 px-2 py-1 text-xs font-medium text-white transition-colors"
                                    : "shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                            }
                        >
                            {copied ? "복사됨" : "복사"}
                        </button>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="self-end rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                >
                    확인 (닫기)
                </button>
            </div>
        </div>
    );
}

// ─── 토큰 행 ─────────────────────────────────────────────────────────────────

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
        if (!confirm(`토큰 "${token.tokenPrefix}…"을 해지하시겠습니까? 해지된 토큰은 복구할 수 없습니다.`)) return;
        revokeMutation.mutate(token.id);
    };

    return (
        <div
            className={
                isRevoked
                    ? "flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 opacity-60"
                    : "flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3"
            }
        >
            {/* 상단: prefix + 해지 배지/버튼 */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-gray-500">{token.tokenPrefix}…</code>
                    {isRevoked ? (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-500">
                            해지됨
                        </span>
                    ) : null}
                </div>
                {!isRevoked ? (
                    <button
                        type="button"
                        onClick={handleRevoke}
                        disabled={revokeMutation.isPending}
                        className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-100 disabled:opacity-50"
                    >
                        {revokeMutation.isPending ? "해지 중…" : "해지"}
                    </button>
                ) : null}
            </div>

            {/* 라벨 편집 (활성 토큰만) */}
            {!isRevoked ? (
                <div className="flex items-center gap-2">
                    {editingLabel ? (
                        <>
                            <label htmlFor={`token-label-${token.id}`} className="sr-only">토큰 라벨</label>
                            <input
                                id={`token-label-${token.id}`}
                                type="text"
                                value={labelInput}
                                onChange={(e) => setLabelInput(e.target.value)}
                                placeholder="라벨 입력"
                                className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 outline-none focus:border-terracotta-400 focus-visible:ring-2 focus-visible:ring-terracotta-500 focus-visible:ring-offset-1"
                            />
                            <button
                                type="button"
                                onClick={handleSaveLabel}
                                disabled={updateMutation.isPending}
                                className="rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                            >
                                {updateMutation.isPending ? "저장 중…" : "저장"}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setLabelInput(token.label ?? "");
                                    setEditingLabel(false);
                                }}
                                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                                취소
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setEditingLabel(true)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                        >
                            {token.label ? token.label : "라벨 없음"} · 수정
                        </button>
                    )}
                </div>
            ) : null}

            {/* 날짜 정보 */}
            <p className="text-xs text-gray-400">
                {token.lastUsedAt !== null
                    ? `마지막 사용: ${new Date(token.lastUsedAt).toLocaleDateString("ko-KR")}`
                    : "아직 사용 안 함"}
                {" · "}생성: {new Date(token.createdAt).toLocaleDateString("ko-KR")}
                {isRevoked && token.revokedAt !== null
                    ? ` · 해지: ${new Date(token.revokedAt).toLocaleDateString("ko-KR")}`
                    : null}
            </p>
        </div>
    );
}
