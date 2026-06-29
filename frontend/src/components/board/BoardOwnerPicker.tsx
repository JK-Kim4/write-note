"use client";

import { useEffect, useState } from "react";
import { useCategories } from "@/lib/query/useCategories";
import { useProjectCards } from "@/lib/query/useProjects";
import type { BoardOwnerType } from "@/lib/api/boards";

/**
 * 보드 소속 picker(041) — "이 보드는 어디에 쓸 건가요?"(이 작품 / 시리즈 전체 / 아이디어) + 대상 선택.
 * 생성(withName=true: 이름 입력 동반)과 소속 변경/나중에 붙이기(withName=false)에 공용.
 * 화면 문구는 board-ux-worksheet §5 강제 — 내부 용어(owner_type 등) 노출 금지.
 */

const COPY = {
    ownerPrompt: "이 보드는 어디에 쓸 건가요?",
    ownerWork: "이 작품",
    ownerSeries: "시리즈 전체",
    ownerNone: "아이디어",
    namePlaceholder: "보드 이름 (예: 인물 관계, 1부 사건 흐름)",
    cancel: "취소",
} as const;

type OwnerKind = "work" | "series" | "idea";

export type BoardOwnerResult = {
    name?: string;
    ownerType: BoardOwnerType | null;
    ownerId: number | null;
};

export function BoardOwnerPicker({
    title,
    withName,
    initialKind = "idea",
    initialOwnerId = null,
    confirmLabel,
    pending = false,
    onConfirm,
    onCancel,
}: {
    title: string;
    withName: boolean;
    initialKind?: OwnerKind;
    initialOwnerId?: number | null;
    confirmLabel: string;
    pending?: boolean;
    onConfirm: (result: BoardOwnerResult) => void;
    onCancel: () => void;
}) {
    const projects = useProjectCards();
    const categories = useCategories();
    const [kind, setKind] = useState<OwnerKind>(initialKind);
    const [targetId, setTargetId] = useState<number | null>(initialOwnerId);
    const [name, setName] = useState("");

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onCancel]);

    const projectList = projects.data ?? [];
    const categoryList = categories.data ?? [];
    const needsTarget = kind === "work" || kind === "series";
    const trimmedName = name.trim();
    const canConfirm = (!withName || trimmedName.length > 0) && (!needsTarget || targetId != null) && !pending;

    const selectKind = (next: OwnerKind) => {
        setKind(next);
        setTargetId(null);
    };

    const handleConfirm = () => {
        if (!canConfirm) return;
        const ownerType: BoardOwnerType | null = kind === "work" ? "project" : kind === "series" ? "category" : null;
        onConfirm({
            name: withName ? trimmedName : undefined,
            ownerType,
            ownerId: needsTarget ? targetId : null,
        });
    };

    const kindButton = (value: OwnerKind, label: string) => (
        <button
            type="button"
            onClick={() => selectKind(value)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ${
                kind === value
                    ? "border-terracotta-500 bg-terracotta-50 text-terracotta-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}
        >
            {label}
        </button>
    );

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={onCancel}
            role="presentation"
        >
            <div
                className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={title}
            >
                <h2 className="text-base font-bold text-gray-900">{title}</h2>

                <p className="mt-4 text-sm font-medium text-gray-700">{COPY.ownerPrompt}</p>
                <div className="mt-2 flex gap-2">
                    {kindButton("work", COPY.ownerWork)}
                    {kindButton("series", COPY.ownerSeries)}
                    {kindButton("idea", COPY.ownerNone)}
                </div>

                {kind === "work" && (
                    <select
                        value={targetId ?? ""}
                        onChange={(e) => setTargetId(e.target.value === "" ? null : Number(e.target.value))}
                        className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none"
                    >
                        <option value="">작품 선택…</option>
                        {projectList.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.title}
                            </option>
                        ))}
                    </select>
                )}
                {kind === "series" && (
                    <select
                        value={targetId ?? ""}
                        onChange={(e) => setTargetId(e.target.value === "" ? null : Number(e.target.value))}
                        className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none"
                    >
                        <option value="">시리즈 선택…</option>
                        {categoryList.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                )}

                {withName && (
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            // 한글 IME 조합 중 Enter 는 조합 확정 + 실제 Enter 로 keydown 이 이중 발화 →
                            // 가드 없으면 handleConfirm 이 2번 호출돼 보드가 중복 생성된다. 조합 중(isComposing)이면 무시.
                            if (e.key === "Enter" && !e.nativeEvent.isComposing) handleConfirm();
                        }}
                        placeholder={COPY.namePlaceholder}
                        className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-terracotta-500 focus:outline-none"
                    />
                )}

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        {COPY.cancel}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        className="rounded-md bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700 disabled:opacity-50"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
